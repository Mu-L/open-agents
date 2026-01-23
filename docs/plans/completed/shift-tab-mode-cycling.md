# Implementation Plan: Shift+Tab Mode Cycling

## Overview

Update TUI shift+tab controls to cycle through three modes:
1. **default** - No special mode active
2. **auto-accept edits** - Auto-approve edit/write tools
3. **plan** - Plan mode active (read-only operations)

The mode indicator should also update when the agent programmatically enters plan mode via `enter_plan_mode` tool.

## Current State

- Shift+Tab cycles: `"off" → "edits" → "all"` (auto-accept modes)
- Agent mode (`"default" | "plan"`) is tracked separately in `agentMode` state
- These two concepts are not unified

## Target State

- Shift+Tab cycles: `"default" → "edits" → "plan"` (unified mode)
- When agent calls `enter_plan_mode`, the UI mode indicator updates
- When agent calls `exit_plan_mode`, the UI mode indicator updates
- Single unified mode concept

## Critical Files

| File | Changes |
|------|---------|
| `packages/tui/types.ts` | Update `AutoAcceptMode` type to include plan mode concept |
| `packages/tui/chat-context.tsx` | Unify mode cycling, remove separate `agentMode` state |
| `packages/tui/components/input-box.tsx` | Update indicator labels/colors |
| `packages/tui/components/status-bar.tsx` | Add plan mode indicator if needed |
| `packages/tui/transport.ts` | Update how mode is passed to agent |
| `packages/tui/app.tsx` | Update mode when agent enters/exits plan mode |

## Implementation Steps

### Step 1: Update Type Definitions

**File:** `packages/tui/types.ts`

Change `AutoAcceptMode` to a unified `PermissionMode`:

```typescript
// Remove: export type AutoAcceptMode = "off" | "edits" | "all";
// Add:
export type PermissionMode = "default" | "edits" | "plan";
```

### Step 2: Update Chat Context

**File:** `packages/tui/chat-context.tsx`

1. Replace `AUTO_ACCEPT_MODES` array:
   ```typescript
   // Remove: const AUTO_ACCEPT_MODES: AutoAcceptMode[] = ["off", "edits", "all"];
   // Add:
   const PERMISSION_MODES: PermissionMode[] = ["default", "edits", "plan"];
   ```

2. Unify state - remove separate `agentMode` state, use single `permissionMode`:
   ```typescript
   const [permissionMode, setPermissionMode] = useState<PermissionMode>("default");
   ```

3. Update cycling function:
   ```typescript
   const cyclePermissionMode = () => {
     setPermissionMode((prev) => {
       const currentIndex = PERMISSION_MODES.indexOf(prev);
       const nextIndex = (currentIndex + 1) % PERMISSION_MODES.length;
       return PERMISSION_MODES[nextIndex] ?? "default";
     });
   };
   ```

4. Add function to set mode directly (for agent-triggered changes):
   ```typescript
   const setMode = useCallback((mode: PermissionMode) => {
     setPermissionMode(mode);
   }, []);
   ```

5. Update context value to expose new state/functions

### Step 3: Update Input Box Indicator

**File:** `packages/tui/components/input-box.tsx`

1. Update label function:
   ```typescript
   const getModeLabel = (mode: PermissionMode): string => {
     switch (mode) {
       case "default":
         return "default";
       case "edits":
         return "auto-accept edits on";
       case "plan":
         return "plan mode";
     }
   };
   ```

2. Update color function:
   ```typescript
   const getModeColor = (mode: PermissionMode): string => {
     switch (mode) {
       case "default":
         return "gray";
       case "edits":
         return "green";
       case "plan":
         return "cyan"; // or "blue" for plan mode distinction
     }
   };
   ```

3. Update indicator component to use new naming

### Step 4: Update App.tsx Mode Detection

**File:** `packages/tui/app.tsx`

When agent calls `enter_plan_mode` or `exit_plan_mode`, update the permission mode:

```typescript
// In the effect that detects tool executions:
if (toolName === "enter_plan_mode" && isOutputAvailable) {
  setPermissionMode("plan");
  setPlanFilePath(filePath);
}

if (toolName === "exit_plan_mode" && isOutputAvailable) {
  setPermissionMode("default"); // or restore previous non-plan mode
  setPlanFilePath(null);
}
```

### Step 5: Update Transport

**File:** `packages/tui/transport.ts`

Map the unified mode to what the agent expects:

```typescript
const permissionMode = getPermissionMode?.() ?? "default";

const agentMode = permissionMode === "plan" ? "plan" : "default";
const autoApprove = permissionMode === "edits" ? "edits" : "off";

const result = await agent.stream({
  messages: prunedMessages,
  options: {
    ...agentOptions,
    approval: {
      type: "interactive",
      autoApprove,
      sessionRules,
    },
    agentMode,
    planFilePath,
  },
});
```

### Step 6: Handle Edge Cases

1. **User manually cycles to plan mode:** Should this enter plan mode on the agent? Or just indicate the user wants plan mode for the next request?
   - Recommendation: Set `agentMode` to "plan" so next agent response respects it

2. **Agent exits plan mode while user had manually set it:** Should revert to default
   - The `exit_plan_mode` handler should set mode to "default"

3. **User cycles away from plan mode while agent is in plan mode:** Should this exit plan mode?
   - Recommendation: Yes, allow user to override by cycling

## Verification

1. **Manual testing:**
   - Press shift+tab multiple times, verify cycling: default → edits → plan → default
   - Verify indicator color changes appropriately
   - Verify label text updates

2. **Agent integration:**
   - Trigger agent to call `enter_plan_mode`, verify indicator updates to plan mode
   - Approve plan, verify indicator returns to default

3. **Mode behavior:**
   - In default mode: tools require approval
   - In edits mode: edit/write tools auto-approved
   - In plan mode: read-only operations only

## Design Decisions

1. **Plan mode via shift+tab:** Updates local state only. The mode will be activated on the next agent request when the state is passed to the agent.

2. **Exit plan mode behavior:** Always reset to "default" mode, regardless of what mode was active before plan mode.
