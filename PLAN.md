Summary: Fix navbar auto-commit / auto-PR detection by treating post-stream git work as an explicit state machine instead of inferring it indirectly from git status and PR polling. Use a two-layer approach: immediate optimistic UI state in the current tab, backed by durable server state so refreshes, route changes, and background completion stay correct.

Context: Key findings from exploration -- existing patterns, relevant files, constraints

- The chat workflow intentionally closes the stream before post-finish work runs. In [apps/web/app/workflows/chat.ts](#workspace-file=apps/web/app/workflows/chat.ts), the stream is closed first, then assistant persistence, auto-commit, auto-PR, and diff refresh happen afterward.
- The current navbar spinner is purely local. [apps/web/app/sessions/[sessionId]/chats/[chatId]/hooks/use-auto-commit-status.ts](#workspace-file=apps/web/app/sessions/[sessionId]/chats/[chatId]/hooks/use-auto-commit-status.ts) only flips `isAutoCommitting` when the local chat status transitions from streaming/submitted to ready.
- That local signal is fragile: it does not survive refreshes, route switches, background tabs, or cases where the local status transition is missed. That matches the observed “sometimes the UI shows Committing..., usually it does not”.
- PR detection is also indirect. The navbar in [apps/web/app/sessions/[sessionId]/chats/[chatId]/session-chat-content.tsx](#workspace-file=apps/web/app/sessions/[sessionId]/chats/[chatId]/session-chat-content.tsx) derives its primary action from `session.prNumber`, git status, and `checkBranchAndPr()`. [apps/web/app/sessions/[sessionId]/chats/[chatId]/session-chat-context.tsx](#workspace-file=apps/web/app/sessions/[sessionId]/chats/[chatId]/session-chat-context.tsx) updates PR info only after follow-up polling/checks.
- There is already a good precedent for this kind of UX: [apps/web/hooks/use-session-chats.ts](#workspace-file=apps/web/hooks/use-session-chats.ts) keeps an optimistic overlay for streaming state and syncs it back to SWR/session summaries.
- The session schema currently stores repo config and PR metadata, but no durable “post-finish workflow phase” that the navbar can read after the stream closes. See [apps/web/lib/db/schema.ts](#workspace-file=apps/web/lib/db/schema.ts).

Approach: High-level design decision and why

- Recommended approach: introduce an explicit post-turn git state machine with both optimistic and durable layers.
- Layer 1: as soon as a streamed turn completes in the current tab, optimistically show the next expected state if auto-commit / auto-PR are enabled.
- Layer 2: persist that state on the server so the navbar can recover after refresh/navigation and so polling knows what it is waiting for.
- This is better than only “render pending if enabled”, because “enabled” is capability/config, not execution state. The UI needs both: what is enabled and what phase is currently running.
- Model the navbar primary action as a single source-of-truth state machine, e.g.:
  - `idle`
  - `streaming`
  - `post_processing:auto_commit`
  - `post_processing:auto_pr`
  - `ready_to_commit`
  - `ready_to_create_pr`
  - `has_open_pr`
- Keep the first implementation minimal: start with post-finish commit/PR phases only, and derive button labels/spinners from that unified state.

Changes:
- [apps/web/lib/db/schema.ts](#workspace-file=apps/web/lib/db/schema.ts) - add durable post-finish metadata on the session or chat (phase, startedAt, lastError, maybe target actions) so the UI can recover pending state after refresh.
- [apps/web/app/workflows/chat.ts](#workspace-file=apps/web/app/workflows/chat.ts) - mark post-finish state before closing the stream or immediately after, then advance/clear it around auto-commit and auto-PR completion/failure.
- [apps/web/app/workflows/chat-post-finish.ts](#workspace-file=apps/web/app/workflows/chat-post-finish.ts) - centralize helpers that advance post-finish phases and persist completion/failure details.
- [apps/web/app/api/sessions/[sessionId]/route.ts](#workspace-file=apps/web/app/api/sessions/[sessionId]/route.ts) and/or [apps/web/app/api/sessions/[sessionId]/chats/route.ts](#workspace-file=apps/web/app/api/sessions/[sessionId]/chats/route.ts) - expose the durable phase in the data the client already polls.
- [apps/web/app/sessions/[sessionId]/chats/[chatId]/session-chat-context.tsx](#workspace-file=apps/web/app/sessions/[sessionId]/chats/[chatId]/session-chat-context.tsx) - keep session state in sync with the new post-finish phase and provide one derived navbar action state.
- [apps/web/app/sessions/[sessionId]/chats/[chatId]/hooks/use-auto-commit-status.ts](#workspace-file=apps/web/app/sessions/[sessionId]/chats/[chatId]/hooks/use-auto-commit-status.ts) - either replace or expand this hook so it consumes durable phase + local optimistic phase instead of only inferring from git status.
- [apps/web/app/sessions/[sessionId]/chats/[chatId]/session-chat-content.tsx](#workspace-file=apps/web/app/sessions/[sessionId]/chats/[chatId]/session-chat-content.tsx) - render navbar buttons from the unified state machine, including explicit labels like “Committing...” and “Creating PR...”.
- [apps/web/hooks/use-session-chats.ts](#workspace-file=apps/web/hooks/use-session-chats.ts) - optionally mirror the existing streaming-overlay pattern for post-finish optimistic state so sidebar/session list can reflect “finishing changes” too.

Verification:
- End-to-end behavior to verify:
  - send a prompt with auto-commit enabled and confirm the navbar immediately switches to “Committing...” when the stream ends
  - refresh during the commit phase and confirm the navbar still shows the pending state
  - enable auto-PR and confirm the navbar moves from “Committing...” to “Creating PR...” to “View PR #..."
  - verify fallback behavior when auto-commit is skipped or fails (pending state clears and manual action becomes available)
  - verify a background/offscreen tab still reconciles correctly when revisited
- Relevant test coverage:
  - workflow tests around post-finish phase transitions in [apps/web/app/workflows/chat.test.ts](#workspace-file=apps/web/app/workflows/chat.test.ts) and [apps/web/app/workflows/chat-post-finish.test.ts](#workspace-file=apps/web/app/workflows/chat-post-finish.test.ts)
  - client-state tests for optimistic + durable reconciliation in [apps/web/app/sessions/[sessionId]/chats/[chatId]/hooks/use-auto-commit-status.ts](#workspace-file=apps/web/app/sessions/[sessionId]/chats/[chatId]/hooks/use-auto-commit-status.ts) and/or [apps/web/app/sessions/[sessionId]/chats/[chatId]/session-chat-content.tsx](#workspace-file=apps/web/app/sessions/[sessionId]/chats/[chatId]/session-chat-content.tsx)
  - run `bun run check`, `bun run typecheck`, `bun run test:isolated`, and `bun run --cwd apps/web db:check` after implementation
