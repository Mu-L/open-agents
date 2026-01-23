# Plan: Exit Plan Mode Renderer & Manual Plan Mode Fixes

## Summary

Two related issues with plan mode:
1. Exit plan mode renderer shows "Requesting approval" text even after approval
2. Manual plan mode entry (shift+tab) doesn't inform the agent it's in plan mode

## Issue Analysis

### Issue 1: Exit Plan Mode Renderer

**Location:** `packages/tui/components/tool-renderers/exit-plan-mode-renderer.tsx`

**Current behavior:** Always shows "Plan complete. Requesting approval to proceed." regardless of state.

**Expected behavior:**
- During streaming/waiting: "Plan complete. Requesting approval to proceed."
- After approval: "Plan approved"
- After denial: Current denial message is correct

**Root cause:** The renderer doesn't check the tool's output state to determine if approval was granted.

### Issue 2: Manual Plan Mode Entry

**Current flow when user presses shift+tab to enter plan mode:**
1. TUI's `permissionMode` state changes to `"plan"`
2. Transport passes `agentMode: "plan"` to agent (line 79 in transport.ts)
3. But `planFilePath` remains `undefined` (no plan file created)
4. System prompt check (`system-prompt.ts:279`) requires BOTH conditions:
   ```typescript
   if (options.agentMode === "plan" && options.planFilePath) {
   ```
5. Since `planFilePath` is undefined, plan mode instructions are NOT added
6. Agent has no idea it's supposed to plan

**Root cause:** Manual mode entry doesn't create a plan file, so the agent never receives plan mode instructions.

## Implementation Plan

### Step 1: Fix Exit Plan Mode Renderer

**File:** `packages/tui/components/tool-renderers/exit-plan-mode-renderer.tsx`

Modify the renderer to show different text based on state:
- Check if `part.state === "result"` and `part.output?.success === true`
- If approved: Show "Plan approved"
- If denied: Show denial message (current behavior)
- Otherwise: Show "Plan complete. Requesting approval to proceed."

```tsx
// Determine the text based on state
const isApproved = part.state === "result" && part.output?.success === true;
const text = state.denied
  ? "Plan rejected"
  : isApproved
    ? "Plan approved"
    : "Plan complete. Requesting approval to proceed.";
```

### Step 2: Create Plan File on Manual Plan Mode Entry

**Approach:** When user cycles to plan mode via shift+tab, automatically create a plan file just like the `enter_plan_mode` tool does.

**Files to modify:**

1. **`packages/tui/chat-context.tsx`**
   - Modify `setPermissionMode` or `cyclePermissionMode` to create a plan file when entering plan mode
   - Import the plan file creation logic from agent package (or extract to shared utility)

2. **Extract plan file creation to shared utility**
   - Create `packages/shared/src/plan-utils.ts` with `createPlanFile()` function
   - This can be used by both the tool and the TUI
   - Generates random name using existing adjective/noun lists
   - Creates the file in `~/.config/open-harness/plans/`

3. **`packages/tui/chat-context.tsx`** (alternative approach)
   - When `cyclePermissionMode` enters plan mode, call the plan file creation utility
   - Update both `permissionMode` and `planFilePath` state together

**Implementation details:**

```typescript
// In chat-context.tsx
const cyclePermissionMode = useCallback(async () => {
  setPermissionModeState((prev) => {
    const currentIndex = PERMISSION_MODES.indexOf(prev);
    const nextIndex = (currentIndex + 1) % PERMISSION_MODES.length;
    const nextMode = PERMISSION_MODES[nextIndex] ?? "default";

    // If entering plan mode, create plan file
    if (nextMode === "plan") {
      // Create plan file asynchronously
      createPlanFile().then((planFilePath) => {
        setPlanFilePath(planFilePath);
      });
    } else if (prev === "plan") {
      // Exiting plan mode, clear plan file path
      setPlanFilePath(undefined);
    }

    return nextMode;
  });
}, []);
```

### Step 3: Handle Plan Mode Exit on Manual Mode Change

When user manually exits plan mode (shift+tab from plan → default), the plan file path should be cleared. This is already partially handled but needs verification.

## Critical Files

1. `packages/tui/components/tool-renderers/exit-plan-mode-renderer.tsx` - Renderer fix
2. `packages/tui/chat-context.tsx` - Manual plan mode entry fix
3. `packages/agent/tools/enter-plan-mode.ts` - Reference for plan file creation logic
4. `packages/shared/src/plan-utils.ts` (new) - Shared plan file utilities

## Trade-offs

**Option A (Recommended): Create plan file on manual entry**
- Pros: Consistent behavior between manual and tool-based plan mode
- Pros: Agent receives full plan mode instructions
- Cons: Creates plan files even if user immediately cycles away

**Option B: Modify system prompt to handle planless plan mode**
- Pros: No file creation overhead
- Cons: Different behavior between manual and tool modes
- Cons: Agent can't write to a plan file (no path)

**Option C: Auto-trigger enter_plan_mode tool on manual entry**
- Pros: Uses existing tool infrastructure
- Cons: Adds complexity, tool approval flow may be confusing

## Testing Strategy

1. **Exit plan mode renderer:**
   - Verify "Plan approved" shows after approval
   - Verify denial message shows correctly
   - Verify streaming state shows approval request

2. **Manual plan mode entry:**
   - Press shift+tab to enter plan mode
   - Verify plan file is created in `~/.config/open-harness/plans/`
   - Verify agent receives plan mode instructions (check system prompt)
   - Verify agent tools are restricted appropriately
   - Press shift+tab again to cycle out, verify plan file path is cleared
