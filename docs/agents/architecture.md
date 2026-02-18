# Architecture

This is a Turborepo monorepo for "Open Harness" - an AI coding agent built with AI SDK.

## Core Flow

```
CLI (apps/cli) -> TUI (packages/tui) -> Agent (packages/agent) -> Sandbox (packages/sandbox)
```

1. **CLI** parses args, creates sandbox, loads AGENTS.md files, and starts the TUI
2. **TUI** renders the terminal UI with OpenTUI, manages chat state via `ChatTransport`
3. **Agent** (`deepAgent`) is a `ToolLoopAgent` with tools for file ops, bash, and task delegation
4. **Sandbox** abstracts file system and shell operations (local fs or remote like Vercel)

## Key Packages

- **packages/agent/** - Core agent implementation with tools, subagents, and context management
- **packages/sandbox/** - Execution environment abstraction (local/remote)
- **packages/tui/** - Terminal UI with OpenTUI components
- **packages/shared/** - Shared utilities across packages

## Subagent Pattern

The `task` tool delegates to specialized subagents:
- **explorer**: Read-only, for codebase research (grep, glob, read, safe bash)
- **executor**: Full access, for implementation tasks (all tools)

## Workspace Structure

```
apps/
  cli/           # CLI entry point (@open-harness/cli)
  web/           # Web interface
packages/
  agent/         # Core agent logic (@open-harness/agent)
  sandbox/       # Sandbox abstraction (@open-harness/sandbox)
  tui/           # Terminal UI (@open-harness/tui)
  shared/        # Shared utilities (@open-harness/shared)
  tsconfig/      # Shared TypeScript configs
```
