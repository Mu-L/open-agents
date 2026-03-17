import type { FinishReason } from "ai";
import type { WebAgentMessageMetadata } from "@/app/types";
import { getWritable } from "workflow";
import type { UIMessageChunk } from "ai";

export async function sendStart(messageId: string): Promise<void> {
  "use step";

  const writer =
    getWritable<UIMessageChunk<WebAgentMessageMetadata>>().getWriter();
  try {
    await writer.write({ type: "start", messageId });
  } finally {
    writer.releaseLock();
  }
}

export async function sendError(errorText: string): Promise<void> {
  "use step";

  const writer =
    getWritable<UIMessageChunk<WebAgentMessageMetadata>>().getWriter();
  try {
    await writer.write({ type: "error", errorText });
  } finally {
    writer.releaseLock();
  }
}

export async function sendFinish(
  finishReason: FinishReason,
  metadata: WebAgentMessageMetadata,
): Promise<void> {
  "use step";

  const writable = getWritable<UIMessageChunk<WebAgentMessageMetadata>>();
  const writer = writable.getWriter();

  try {
    await writer.write({
      type: "finish",
      finishReason,
      messageMetadata: metadata,
    });
  } catch (error) {
    if (
      !(error instanceof TypeError) ||
      !String(error.message).includes("WritableStream is closed")
    ) {
      throw error;
    }
  } finally {
    writer.releaseLock();
  }

  try {
    await writable.close();
  } catch (error) {
    if (
      !(error instanceof TypeError) ||
      !String(error.message).includes("WritableStream is closed")
    ) {
      throw error;
    }
  }
}
