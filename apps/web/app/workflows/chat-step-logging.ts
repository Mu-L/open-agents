type ChatStepLogContext = {
  chatId: string;
  sessionId: string;
  assistantId: string;
  modelId: string;
  subagentModelId?: string;
};

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return String(error);
}

export function createChatStepLogger(context: ChatStepLogContext) {
  const startedAtMs = Date.now();

  return {
    log(event: string, details?: Record<string, unknown>) {
      console.info(
        "[chat-step]",
        JSON.stringify({
          ...context,
          event,
          elapsedMs: Date.now() - startedAtMs,
          ...details,
        }),
      );
    },
    error(event: string, error: unknown, details?: Record<string, unknown>) {
      console.error(
        "[chat-step]",
        JSON.stringify({
          ...context,
          event,
          elapsedMs: Date.now() - startedAtMs,
          error: normalizeError(error),
          ...details,
        }),
      );
    },
  };
}
