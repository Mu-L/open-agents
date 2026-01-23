import React from "react";
import { Box, Text } from "ink";
import type { ToolRendererProps } from "../../lib/render-tool";
import { ToolSpinner, getDotColor } from "./shared";

export function ExitPlanModeRenderer({
  part,
  state,
}: ToolRendererProps<"tool-exit_plan_mode">) {
  const isStreaming = part.state === "input-streaming";
  const dotColor = getDotColor(state);

  // Check if plan was approved (tool executed successfully after approval)
  const isApproved =
    part.state === "output-available" &&
    typeof part.output === "object" &&
    part.output !== null &&
    "success" in part.output &&
    part.output.success === true;

  // Determine text based on state
  const text = state.denied
    ? "Plan rejected"
    : isApproved
      ? "Plan approved"
      : "Plan complete. Requesting approval to proceed.";

  const textColor = state.denied ? "red" : isApproved ? "green" : "white";

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Box>
        {isStreaming ? <ToolSpinner /> : <Text color={dotColor}>● </Text>}
        <Text bold color={textColor}>
          {text}
        </Text>
      </Box>

      {state.denied && (
        <Box paddingLeft={2}>
          <Text color="gray">└ </Text>
          <Text color="red">
            Denied{state.denialReason ? `: ${state.denialReason}` : ""}
          </Text>
        </Box>
      )}
    </Box>
  );
}
