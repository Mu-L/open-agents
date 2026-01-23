# Plan Mode Improvements

## Overview

This plan addresses three improvements to the plan mode feature:

1. **Plan file edits require approval** - All writes/edits to the plan file should require user approval
2. **Store plans in system config directory** - Plans should be saved in `~/.config/open-harness/plans` with random 3-word names
3. **Custom TUI for ExitPlanMode approval** - Show a custom approval UI when ExitPlanMode is called

---

## 1. Plan File Edits Auto-Approved

### Current Behavior
- In `packages/agent/tools/write.ts`, the `needsApproval` function uses `pathNeedsApproval()` which may require approval based on working directory rules
- Plan file is stored outside the working directory, so it would normally require approval

### Changes Required

**File: `packages/agent/tools/write.ts`**

Modify both `writeFileTool` and `editFileTool` `needsApproval` functions to:
1. Check if currently in plan mode (from `experimental_context`)
2. Check if the file being written/edited is the plan file
3. If both conditions are true, always return `false` (auto-approve since it's the only file allowed)

```typescript
needsApproval: async (args, { experimental_context }) => {
  const ctx = getApprovalContext(experimental_context, "write");
  const { approval, agentMode, planFilePath } = ctx;

  // Background and delegated modes auto-approve all operations
  if (shouldAutoApprove(approval)) {
    return false;
  }

  // In plan mode, auto-approve writes to the plan file (it's the only file allowed)
  if (agentMode === "plan" && planFilePath) {
    const absolutePath = path.isAbsolute(args.filePath)
      ? args.filePath
      : path.resolve(ctx.workingDirectory, args.filePath);
    if (absolutePath === planFilePath) {
      return false;
    }
  }

  return pathNeedsApproval({
    path: args.filePath,
    tool: "write",
    approval,
    workingDirectory: ctx.workingDirectory,
  });
},
```

**File: `packages/agent/tools/utils.ts`**

Update `getApprovalContext` to also return `agentMode` and `planFilePath`:

```typescript
export function getApprovalContext(
  context: unknown,
  toolName: string,
): {
  approval: ApprovalContext;
  workingDirectory: string;
  agentMode: AgentMode;
  planFilePath: string | undefined;
} {
  // ... existing code ...
  return {
    approval: ctx.approval,
    workingDirectory: ctx.sandbox.workingDirectory,
    agentMode: ctx.agentMode ?? "default",
    planFilePath: ctx.planFilePath,
  };
}
```

---

## 2. Store Plans in System Config Directory

### Current Behavior
- Plans are stored as `.plan.md` in the working directory
- Path is generated in `enterPlanModeTool`

### Changes Required

**File: `packages/tui/lib/plan-storage.ts` (NEW)**

Create a new file for plan storage utilities:

```typescript
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";

const CONFIG_DIR = join(homedir(), ".config", "open-harness");
const PLANS_DIR = join(CONFIG_DIR, "plans");

// Word lists for generating random names
const ADJECTIVES = [
  "giggling", "dancing", "sleeping", "running", "jumping",
  "singing", "floating", "spinning", "glowing", "buzzing",
  "flying", "crawling", "bouncing", "whistling", "humming",
  // ... add more for variety
];

const ANIMALS = [
  "lark", "panda", "otter", "fox", "owl",
  "tiger", "dolphin", "koala", "penguin", "rabbit",
  "eagle", "salmon", "turtle", "zebra", "falcon",
  // ... add more for variety
];

const COLORS = [
  "crimson", "azure", "golden", "silver", "coral",
  "violet", "emerald", "amber", "ivory", "jade",
  // ... add more for variety
];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]!;
}

export function generatePlanName(): string {
  const adjective = randomElement(ADJECTIVES);
  const color = randomElement(COLORS);
  const animal = randomElement(ANIMALS);
  return `${adjective}-${color}-${animal}`;
}

export async function ensurePlansDir(): Promise<void> {
  await mkdir(PLANS_DIR, { recursive: true });
}

export function getPlanFilePath(planName: string): string {
  return join(PLANS_DIR, `${planName}.md`);
}

export function getPlansDir(): string {
  return PLANS_DIR;
}
```

**File: `packages/agent/tools/enter-plan-mode.ts`**

Modify to use the system config directory:

```typescript
import { tool } from "ai";
import { z } from "zod";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

// Word lists for generating random names (inline or import from shared)
const ADJECTIVES = ["giggling", "dancing", "sleeping", /* ... */];
const COLORS = ["crimson", "azure", "golden", /* ... */];
const ANIMALS = ["lark", "panda", "otter", /* ... */];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]!;
}

function generatePlanName(): string {
  const adjective = randomElement(ADJECTIVES);
  const color = randomElement(COLORS);
  const animal = randomElement(ANIMALS);
  return `${adjective}-${color}-${animal}`;
}

const CONFIG_DIR = join(homedir(), ".config", "open-harness");
const PLANS_DIR = join(CONFIG_DIR, "plans");

export const enterPlanModeTool = () =>
  tool({
    needsApproval: true,
    description: `...`,
    inputSchema: enterPlanModeInputSchema,
    execute: async (_args, { experimental_context }) => {
      // Ensure plans directory exists
      await mkdir(PLANS_DIR, { recursive: true });

      // Generate unique plan name
      const planName = generatePlanName();
      const planFilePath = join(PLANS_DIR, `${planName}.md`);

      return {
        success: true,
        message: "Entered plan mode. You can now explore the codebase and write your plan.",
        planFilePath,
        planName, // Include for display purposes
      };
    },
  });
```

**File: `packages/agent/tools/enter-plan-mode.ts`**

Update the output type:

```typescript
export type EnterPlanModeOutput = {
  success: boolean;
  message: string;
  planFilePath: string;
  planName: string;
};
```

---

## 3. Custom TUI for ExitPlanMode Approval

### Current Behavior
- `exit_plan_mode` uses the default renderer
- Approval goes through the standard `ApprovalPanel`

### Changes Required

**File: `packages/tui/components/tool-renderers/exit-plan-mode-renderer.tsx` (NEW)**

Create a custom renderer for the exit_plan_mode tool:

```typescript
import React from "react";
import { Box, Text } from "ink";
import type { ToolRendererProps } from "../../lib/render-tool";
import { ToolSpinner, getDotColor } from "./shared";

type ExitPlanModeOutput = {
  success: boolean;
  message?: string;
  error?: string;
  plan: string | null;
  planFilePath: string | null;
};

function isExitPlanModeOutput(value: unknown): value is ExitPlanModeOutput {
  if (typeof value !== "object" || value === null) return false;
  return "success" in value && "plan" in value;
}

export function ExitPlanModeRenderer({
  part,
  state,
}: ToolRendererProps<"tool-exit_plan_mode">) {
  const isStreaming = part.state === "input-streaming";
  const dotColor = getDotColor(state);

  // Extract output when available
  const output =
    part.state === "output-available" && isExitPlanModeOutput(part.output)
      ? part.output
      : undefined;

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Box>
        {isStreaming ? <ToolSpinner /> : <Text color={dotColor}>● </Text>}
        <Text bold color={state.denied ? "red" : "white"}>
          Plan written. Exiting plan mode for your approval.
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
```

**File: `packages/tui/components/plan-approval-panel.tsx` (NEW)**

Create the custom approval panel for plan mode:

```typescript
import React, { useState, useEffect, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { useChat } from "@ai-sdk/react";
import { useChatContext } from "../chat-context";
import { renderMarkdown } from "../lib/markdown";
import type { ExitPlanModeOutput } from "@open-harness/agent";

export type PlanApprovalPanelProps = {
  approvalId: string;
  plan: string | null;
  planFilePath: string;
};

export function PlanApprovalPanel({
  approvalId,
  plan,
  planFilePath,
}: PlanApprovalPanelProps) {
  const { chat } = useChatContext();
  const { addToolApprovalResponse } = useChat({ chat });

  const [selected, setSelected] = useState(0);
  const [feedback, setFeedback] = useState("");

  // Reset state when approval request changes
  useEffect(() => {
    setSelected(0);
    setFeedback("");
  }, [approvalId]);

  const renderedPlan = useMemo(() => {
    if (!plan) return null;
    return renderMarkdown(plan);
  }, [plan]);

  // Extract just the filename from the path for display
  const planName = planFilePath.split("/").pop()?.replace(".md", "") ?? "";

  // Options:
  // 0: Yes, clear context and auto-accept edits (shift+tab)
  // 1: Yes, auto-accept edits
  // 2: Yes, manually approve edits
  // 3: Type feedback (text input)
  const feedbackOptionIndex = 3;

  useInput((input, key) => {
    // Handle escape to cancel
    if (key.escape) {
      addToolApprovalResponse({ id: approvalId, approved: false });
      return;
    }

    // Shift+Tab shortcut for option 0
    if (key.shift && key.tab) {
      // TODO: Implement clear context + auto-accept logic
      addToolApprovalResponse({ id: approvalId, approved: true });
      return;
    }

    // When on text input option
    if (selected === feedbackOptionIndex) {
      if (key.return && feedback.trim()) {
        addToolApprovalResponse({
          id: approvalId,
          approved: false,
          reason: feedback.trim(),
        });
      } else if (key.backspace || key.delete) {
        setFeedback((prev) => prev.slice(0, -1));
      } else if (key.upArrow || (key.ctrl && input === "p")) {
        setSelected(feedbackOptionIndex - 1);
      } else if (input && !key.ctrl && !key.meta && !key.return) {
        setFeedback((prev) => prev + input);
      }
      return;
    }

    const goUp = key.upArrow || input === "k" || (key.ctrl && input === "p");
    const goDown = key.downArrow || input === "j" || (key.ctrl && input === "n");

    if (goUp) {
      setSelected((prev) => (prev === 0 ? feedbackOptionIndex : prev - 1));
    }
    if (goDown) {
      setSelected((prev) => (prev === feedbackOptionIndex ? 0 : prev + 1));
    }

    if (key.return) {
      if (selected === 0) {
        // Yes, clear context and auto-accept edits
        // TODO: Implement clear context logic
        addToolApprovalResponse({ id: approvalId, approved: true });
      } else if (selected === 1) {
        // Yes, auto-accept edits
        addToolApprovalResponse({ id: approvalId, approved: true });
      } else if (selected === 2) {
        // Yes, manually approve edits
        addToolApprovalResponse({ id: approvalId, approved: true });
      }
    }
  });

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor="gray"
      paddingTop={1}
    >
      {/* Header */}
      <Text color="blueBright" bold>
        Ready to code?
      </Text>

      <Box marginTop={1}>
        <Text>Here is Claude's plan:</Text>
      </Box>

      {/* Plan content */}
      {renderedPlan && (
        <Box
          flexDirection="column"
          marginTop={1}
          marginLeft={2}
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          paddingY={1}
        >
          <Text>{renderedPlan}</Text>
        </Box>
      )}

      {!renderedPlan && (
        <Box marginTop={1} marginLeft={2}>
          <Text color="gray">(No plan content)</Text>
        </Box>
      )}

      {/* Options */}
      <Box flexDirection="column" marginTop={1}>
        <Text>Would you like to proceed?</Text>
        <Box flexDirection="column" marginTop={1}>
          {/* Option 1 */}
          <Text>
            <Text color="yellow">{selected === 0 ? "› " : "  "}</Text>
            <Text color={selected === 0 ? "yellow" : undefined}>
              1. Yes, clear context and auto-accept edits
            </Text>
            <Text color="gray"> (shift+tab)</Text>
          </Text>

          {/* Option 2 */}
          <Text>
            <Text color="yellow">{selected === 1 ? "› " : "  "}</Text>
            <Text color={selected === 1 ? "yellow" : undefined}>
              2. Yes, auto-accept edits
            </Text>
          </Text>

          {/* Option 3 */}
          <Text>
            <Text color="yellow">{selected === 2 ? "› " : "  "}</Text>
            <Text color={selected === 2 ? "yellow" : undefined}>
              3. Yes, manually approve edits
            </Text>
          </Text>

          {/* Option 4: Text input */}
          <Box>
            <Text color="yellow">
              {selected === feedbackOptionIndex ? "› " : "  "}
            </Text>
            <Text color={selected === feedbackOptionIndex ? "yellow" : undefined}>
              4.{" "}
            </Text>
            {feedback || selected === feedbackOptionIndex ? (
              <>
                <Text color={selected === feedbackOptionIndex ? "yellow" : undefined}>
                  {feedback}
                </Text>
                {selected === feedbackOptionIndex && <Text color="gray">█</Text>}
              </>
            ) : (
              <Text color="gray">Type here to tell Claude what to change</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Footer hint */}
      <Box marginTop={1}>
        <Text color="gray">
          ctrl-g to edit in Nvim · ~/.claude/plans/{planName}.md
        </Text>
      </Box>
    </Box>
  );
}
```

**File: `packages/tui/lib/render-tool.tsx`**

Update to use the new renderer:

```typescript
import { ExitPlanModeRenderer } from "../components/tool-renderers/exit-plan-mode-renderer";

// ... in renderToolPart switch statement ...
case "tool-exit_plan_mode":
  return <ExitPlanModeRenderer part={part} state={state} />;
```

**File: `packages/tui/app.tsx`**

Add detection and rendering of plan approval panel:

```typescript
import { PlanApprovalPanel } from "./components/plan-approval-panel";
import type { ExitPlanModeOutput } from "@open-harness/agent";

// In AppContent function, add detection for exit_plan_mode approval:
const { hasPendingPlanApproval, planApprovalId, planOutput } = useMemo(() => {
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "assistant") {
    for (const p of lastMessage.parts) {
      if (
        isToolUIPart(p) &&
        p.type === "tool-exit_plan_mode" &&
        p.state === "approval-requested"
      ) {
        const approval = (p as { approval?: { id: string } }).approval;
        const output = p.output as ExitPlanModeOutput | undefined;
        return {
          hasPendingPlanApproval: true,
          planApprovalId: approval?.id ?? null,
          planOutput: output,
        };
      }
    }
  }
  return {
    hasPendingPlanApproval: false,
    planApprovalId: null,
    planOutput: null,
  };
}, [messages]);

// In the render section, before the regular approval panel:
{state.activePanel.type === "none" &&
  hasPendingPlanApproval &&
  planApprovalId &&
  planOutput?.planFilePath ? (
  <PlanApprovalPanel
    approvalId={planApprovalId}
    plan={planOutput.plan}
    planFilePath={planOutput.planFilePath}
  />
) : /* ... rest of existing approval logic ... */}
```

---

## Implementation Order

1. **Plan storage utilities** - Create `packages/tui/lib/plan-storage.ts` with word lists and name generation
2. **Update enter_plan_mode** - Modify to use system config directory and generate random names
3. **Update utils.ts** - Add agentMode and planFilePath to `getApprovalContext`
4. **Update write.ts** - Add plan file approval requirement
5. **Create ExitPlanModeRenderer** - Simple status renderer for the tool
6. **Create PlanApprovalPanel** - Full custom approval UI
7. **Update render-tool.tsx** - Use new renderer for exit_plan_mode
8. **Update app.tsx** - Detect and show plan approval panel
9. **Export types** - Update index files as needed

---

## Verification

1. Run `turbo typecheck` - no type errors
2. Run `turbo dev` and test:
   - Enter plan mode → verify plan file created in `~/.config/open-harness/plans/`
   - Write to plan file → verify approval is required
   - Exit plan mode → verify custom approval UI is shown
   - Approve plan → verify mode switches back to default
   - Reject/modify plan → verify feedback is passed back

---

## Notes

- The "clear context" option (option 1) is marked as TODO for later implementation
- The ctrl-g hint for editing in Nvim is shown but actual editor integration is not implemented
- Word lists should be expanded for more variety in plan names
- The plan approval panel should match the screenshots provided (see attached images)
