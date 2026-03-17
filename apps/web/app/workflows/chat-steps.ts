import type { AgentModelSelection } from "@open-harness/agent";
import type { SandboxState } from "@open-harness/sandbox";
import {
  convertToModelMessages,
  generateId as generateAiId,
  type FinishReason,
  type LanguageModelUsage,
  type ModelMessage,
  type UIMessageChunk,
} from "ai";
import { getWritable } from "workflow";
import { claimStreamOwnership } from "@/app/api/chat/_lib/stream-lifecycle";
import type { WebAgentMessageMetadata, WebAgentUIMessage } from "@/app/types";
import { hasRenderableAssistantPart } from "@/lib/chat-streaming-state";
import {
  compareAndSetChatActiveStreamId,
  getChatById,
  getSessionById,
  updateChatAssistantActivity,
  updateSession,
  upsertChatMessageScoped,
} from "@/lib/db/sessions";
import { recordUsage } from "@/lib/db/usage";
import { buildActiveLifecycleUpdate } from "@/lib/sandbox/lifecycle";
import { mergeLanguageModelUsage } from "./chat-shared";
import { createChatStepLogger } from "./chat-step-logging";
import { createChatStepAbortLifecycle } from "./chat-step-timeout";
import {
  type ActiveSessionRecord,
  createWorkflowChatRuntime,
} from "./chat-runtime";

const cachedInputTokensFor = (usage: LanguageModelUsage) =>
  usage.inputTokenDetails?.cacheReadTokens ?? usage.cachedInputTokens ?? 0;

export async function convertMessages(
  messages: WebAgentUIMessage[],
): Promise<ModelMessage[]> {
  "use step";

  const { webAgent } = await import("@/app/config");

  return convertToModelMessages(messages, {
    ignoreIncompleteToolCalls: true,
    tools: webAgent.tools,
  });
}

export async function generateMessageId(): Promise<string> {
  "use step";
  return generateAiId();
}

export async function ensureChatStreamOwnership(
  chatId: string,
  ownedStreamToken: string,
  requestStartedAtMs: number,
): Promise<boolean> {
  "use step";

  return claimStreamOwnership({
    chatId,
    ownedStreamToken,
    requestStartedAtMs,
  });
}

export async function hasChatStreamOwnership(
  chatId: string,
  ownedStreamToken: string,
): Promise<boolean> {
  "use step";

  const chat = await getChatById(chatId);
  return chat?.activeStreamId === ownedStreamToken;
}

export interface ChatAgentStepResult {
  responseMessage: WebAgentUIMessage;
  responseMessages: ModelMessage[];
  finishReason: FinishReason;
  usage: LanguageModelUsage | undefined;
  sandboxState: SandboxState | undefined;
  aborted: boolean;
}

export async function runChatAgentStep(params: {
  userId: string;
  sessionId: string;
  chatId: string;
  model: AgentModelSelection;
  subagentModel?: AgentModelSelection;
  messages: ModelMessage[];
  originalMessages: WebAgentUIMessage[];
  assistantId: string;
}): Promise<ChatAgentStepResult> {
  "use step";

  const sessionRecord = await getSessionById(params.sessionId);
  if (!sessionRecord?.sandboxState) {
    throw new Error("Sandbox state is required to continue chat workflow");
  }

  const activeSessionRecord: ActiveSessionRecord = {
    ...sessionRecord,
    sandboxState: sessionRecord.sandboxState,
  };

  const [{ webAgent }, { sandbox, skills }] = await Promise.all([
    import("@/app/config"),
    createWorkflowChatRuntime({
      userId: params.userId,
      sessionRecord: activeSessionRecord,
    }),
  ]);

  const logger = createChatStepLogger({
    chatId: params.chatId,
    sessionId: params.sessionId,
    assistantId: params.assistantId,
    modelId: params.model.id,
    ...(params.subagentModel
      ? { subagentModelId: params.subagentModel.id }
      : {}),
  });
  let responseMessage: WebAgentUIMessage | undefined;
  let streamAborted = false;
  let streamedFinishReason: FinishReason | undefined;
  let streamedPartCount = 0;
  let firstPartType: string | null = null;
  const abortLifecycle = createChatStepAbortLifecycle();
  const writable = getWritable<UIMessageChunk<WebAgentMessageMetadata>>();
  const writer = writable.getWriter();

  logger.log("step-start", {
    inputMessageCount: params.messages.length,
    originalMessageCount: params.originalMessages.length,
  });

  try {
    logger.log("agent-stream-start");
    const result = await webAgent.stream({
      messages: params.messages,
      options: {
        sandbox: {
          state: sessionRecord.sandboxState,
          workingDirectory: sandbox.workingDirectory,
          currentBranch: sandbox.currentBranch,
          environmentDetails: sandbox.environmentDetails,
        },
        model: params.model,
        ...(params.subagentModel
          ? {
              subagentModel: params.subagentModel,
            }
          : {}),
        ...(skills.length > 0 ? { skills } : {}),
      },
      abortSignal: abortLifecycle.signal,
    });
    logger.log("agent-stream-opened");

    for await (const part of result.toUIMessageStream<WebAgentUIMessage>({
      originalMessages: params.originalMessages,
      generateMessageId: () => params.assistantId,
      sendStart: false,
      sendFinish: false,
      messageMetadata: ({ part }) => {
        if (part.type === "finish-step") {
          return { lastStepUsage: part.usage };
        }

        return undefined;
      },
      onFinish: ({
        responseMessage: finishedResponseMessage,
        isAborted,
        finishReason,
      }) => {
        responseMessage = finishedResponseMessage;
        streamAborted = isAborted;
        streamedFinishReason = finishReason ?? (isAborted ? "stop" : undefined);
      },
    })) {
      streamedPartCount += 1;
      if (firstPartType === null) {
        firstPartType = part.type;
        logger.log("first-ui-chunk", { partType: part.type });
      }

      await writer.write(part);
    }

    logger.log("ui-stream-consumed", {
      streamedPartCount,
      firstPartType,
      streamAborted,
      streamedFinishReason,
    });

    if (!responseMessage) {
      throw new Error("Agent stream finished without a response message");
    }

    const sandboxState = sandbox.getState?.() as SandboxState | undefined;
    if (streamAborted) {
      logger.log("step-aborted", {
        streamedPartCount,
        finishReason: streamedFinishReason ?? "stop",
        sandboxStateAvailable: sandboxState !== undefined,
      });
      return {
        responseMessage,
        responseMessages: [],
        finishReason: streamedFinishReason ?? "stop",
        usage: undefined,
        sandboxState,
        aborted: true,
      };
    }

    logger.log("await-response-messages-start");
    const responseMessages = (await result.response).messages;
    logger.log("await-response-messages-done", {
      responseMessageCount: responseMessages.length,
    });

    logger.log("await-finish-reason-start");
    const finishReason = await result.finishReason;
    logger.log("await-finish-reason-done", { finishReason });

    logger.log("await-usage-start");
    const usage = await result.usage;
    logger.log("await-usage-done", {
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      totalTokens: usage?.totalTokens,
    });

    logger.log("step-complete", {
      streamedPartCount,
      sandboxStateAvailable: sandboxState !== undefined,
    });

    return {
      responseMessage,
      responseMessages,
      finishReason,
      usage,
      sandboxState,
      aborted: false,
    };
  } catch (error) {
    logger.error("step-error", error, {
      streamedPartCount,
      firstPartType,
      streamAborted,
      streamedFinishReason,
    });
    throw error;
  } finally {
    abortLifecycle.cleanup();
    writer.releaseLock();
    logger.log("step-finally", {
      streamedPartCount,
      streamAborted,
      streamedFinishReason,
    });
  }
}

export async function clearChatActiveStreamIfOwned(
  chatId: string,
  ownedStreamToken: string,
): Promise<boolean> {
  "use step";

  try {
    return await compareAndSetChatActiveStreamId(
      chatId,
      ownedStreamToken,
      null,
    );
  } catch (error) {
    console.error("Failed to clear active chat stream:", error);
    return false;
  }
}

export async function finalizeChatWorkflowRun(params: {
  userId: string;
  sessionId: string;
  chatId: string;
  ownedStreamToken: string;
  responseMessage: WebAgentUIMessage;
  sandboxState: SandboxState | undefined;
  modelId: string;
  totalMessageUsage: LanguageModelUsage | undefined;
}): Promise<void> {
  "use step";

  const stillOwnsStream = await clearChatActiveStreamIfOwned(
    params.chatId,
    params.ownedStreamToken,
  );
  if (!stillOwnsStream) {
    return;
  }

  const activityAt = new Date();

  const hasRenderableAssistantContent = params.responseMessage.parts.some(
    hasRenderableAssistantPart,
  );

  if (hasRenderableAssistantContent) {
    try {
      const upsertResult = await upsertChatMessageScoped({
        id: params.responseMessage.id,
        chatId: params.chatId,
        role: "assistant",
        parts: params.responseMessage,
      });

      if (upsertResult.status === "conflict") {
        console.warn(
          `Skipped assistant message upsert due to ID scope conflict: ${params.responseMessage.id}`,
        );
      } else if (upsertResult.status === "inserted") {
        await updateChatAssistantActivity(params.chatId, activityAt);
      }
    } catch (error) {
      console.error("Failed to save assistant message:", error);
    }
  }

  const currentSession = await getSessionById(params.sessionId);
  const persistedSandboxState =
    params.sandboxState ?? currentSession?.sandboxState;

  if (persistedSandboxState) {
    try {
      await updateSession(params.sessionId, {
        sandboxState: params.sandboxState ?? persistedSandboxState,
        ...buildActiveLifecycleUpdate(persistedSandboxState, {
          activityAt,
        }),
      });
    } catch (error) {
      console.error("Failed to persist sandbox state:", error);
    }
  }

  const usageWrites: Promise<void>[] = [];

  if (params.totalMessageUsage) {
    usageWrites.push(
      recordUsage(params.userId, {
        source: "web",
        agentType: "main",
        model: params.modelId,
        messages: [params.responseMessage],
        usage: {
          inputTokens: params.totalMessageUsage.inputTokens ?? 0,
          cachedInputTokens: cachedInputTokensFor(params.totalMessageUsage),
          outputTokens: params.totalMessageUsage.outputTokens ?? 0,
        },
      }).catch((error) => {
        console.error("Failed to record main agent usage:", error);
      }),
    );
  }

  const { collectTaskToolUsageEvents } = await import("@open-harness/agent");
  const subagentUsageEvents = collectTaskToolUsageEvents(
    params.responseMessage,
  );
  if (subagentUsageEvents.length > 0) {
    const subagentUsageByModel = new Map<string, LanguageModelUsage>();

    for (const event of subagentUsageEvents) {
      const eventModelId = event.modelId ?? params.modelId;
      if (!eventModelId) {
        continue;
      }

      const combinedUsage = mergeLanguageModelUsage(
        subagentUsageByModel.get(eventModelId),
        event.usage,
      );
      if (combinedUsage) {
        subagentUsageByModel.set(eventModelId, combinedUsage);
      }
    }

    for (const [eventModelId, usage] of subagentUsageByModel) {
      usageWrites.push(
        recordUsage(params.userId, {
          source: "web",
          agentType: "subagent",
          model: eventModelId,
          messages: [],
          usage: {
            inputTokens: usage.inputTokens ?? 0,
            cachedInputTokens: cachedInputTokensFor(usage),
            outputTokens: usage.outputTokens ?? 0,
          },
        }).catch((error) => {
          console.error("Failed to record subagent usage:", error);
        }),
      );
    }
  }

  await Promise.all(usageWrites);
}
