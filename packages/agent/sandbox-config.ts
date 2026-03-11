import {
  connectSandbox,
  createLocalSandbox,
  type Sandbox,
  type SandboxState,
} from "@open-harness/sandbox";
import { z } from "zod";

const DEFAULT_VERCEL_WORKING_DIRECTORY = "/vercel/sandbox";
const DEFAULT_IN_MEMORY_WORKING_DIRECTORY = "/workspace";

const LOCAL_ENVIRONMENT_DETAILS = `- Full shell access with all standard CLI tools
- Git and GitHub CLI (gh) available
- Can install packages and run any commands`;

const IN_MEMORY_ENVIRONMENT_DETAILS = `- Simulated shell environment (not a real bash process)
- Git is NOT available - do not attempt git operations
- Limited to basic file operations and shell commands
- No package installation or network access`;

const CLOUD_ENVIRONMENT_DETAILS = `- Ephemeral sandbox - all work is lost unless committed and pushed to git
- Default workflow: create a new branch, commit changes, push, and open a PR (since the sandbox is ephemeral, this ensures work is preserved)
- All bash commands already run in the working directory by default - never prepend \`cd <working-directory> &&\`; just run the command directly
- Do NOT prefix any bash command with a \`cd\` to the working directory - commands like \`cd <working-directory> && npm test\` are WRONG; just use \`npm test\`
- Use workspace-relative paths for read/write/search/edit operations
- Git is already configured (user, email, remote auth) - no setup or verification needed
- GitHub CLI (gh) is NOT available - use curl with the GitHub API to create PRs
  Use the $GITHUB_TOKEN environment variable directly (do not paste the actual token):
  curl -X POST -H "Authorization: token $GITHUB_TOKEN" -H "Accept: application/vnd.github.v3+json" https://api.github.com/repos/OWNER/REPO/pulls -d '{"title":"...","head":"branch","base":"main","body":"..."}'
- Node.js runtime with npm/pnpm available
- Bun and jq are preinstalled
- Dependencies may not be installed. Before running project scripts (build, typecheck, lint, test), check if \`node_modules\` exists and run the package manager install command if needed (e.g. \`bun install\`, \`npm install\`)
- This snapshot includes agent-browser; when validating UI or end-to-end behavior, start the dev server and use agent-browser against the local dev server URL
- This sandbox already runs on Vercel; do not suggest deploying to Vercel just to obtain a shareable preview link`;

export const sandboxStateSchema = z.custom<SandboxState>(
  (value) =>
    z
      .object({
        type: z.enum(["just-bash", "vercel", "hybrid"]),
      })
      .safeParse(value).success,
);

export const sandboxConnectOptionsSchema = z.object({
  env: z.record(z.string(), z.string()).optional(),
  gitUser: z
    .object({
      name: z.string().min(1),
      email: z.string().min(1),
    })
    .optional(),
  timeout: z.number().int().positive().optional(),
  ports: z.array(z.number().int().positive()).optional(),
  baseSnapshotId: z.string().min(1).optional(),
});

const sandboxRuntimeHintsSchema = z.object({
  host: z.string().min(1).optional(),
  previewUrlsByPort: z.record(z.string(), z.string().min(1)).optional(),
});

type SandboxRuntimeHints = z.infer<typeof sandboxRuntimeHintsSchema>;

export const sandboxConfigSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("local"),
    workingDirectory: z.string().min(1),
    env: z.record(z.string(), z.string()).optional(),
  }),
  z.object({
    kind: z.literal("state"),
    state: sandboxStateSchema,
    options: sandboxConnectOptionsSchema.optional(),
    runtimeHints: sandboxRuntimeHintsSchema.optional(),
  }),
]);

export type OpenHarnessSandboxConfig = z.infer<typeof sandboxConfigSchema>;

function appendRuntimeHintsToEnvironmentDetails(
  baseDetails: string,
  runtimeHints?: SandboxRuntimeHints,
): string {
  if (!runtimeHints) {
    return baseDetails;
  }

  const host = runtimeHints.host?.trim();
  const previewUrlsByPort = runtimeHints.previewUrlsByPort;

  const portLines: string[] = [];
  if (previewUrlsByPort) {
    const sortedEntries = Object.entries(previewUrlsByPort).toSorted(
      ([leftPort], [rightPort]) => {
        const left = Number(leftPort);
        const right = Number(rightPort);
        const leftIsNumber = Number.isFinite(left);
        const rightIsNumber = Number.isFinite(right);

        if (leftIsNumber && rightIsNumber) {
          return left - right;
        }
        if (leftIsNumber) {
          return -1;
        }
        if (rightIsNumber) {
          return 1;
        }
        return leftPort.localeCompare(rightPort);
      },
    );

    for (const [port, url] of sortedEntries) {
      const trimmedUrl = url.trim();
      if (trimmedUrl.length === 0) {
        continue;
      }

      const numericPort = Number(port);
      if (Number.isFinite(numericPort)) {
        portLines.push(`  - Port ${numericPort}: ${trimmedUrl}`);
        continue;
      }

      portLines.push(`  - ${port}: ${trimmedUrl}`);
    }
  }

  if (!host && portLines.length === 0) {
    return baseDetails;
  }

  const hostLine = host ? `\n- Sandbox host: ${host}` : "";
  const previewLines =
    portLines.length > 0
      ? `\n- Dev server URLs for locally running servers (start a server on one of these ports, then share the URL with the user):\n${portLines.join("\n")}`
      : "";
  const runtimeEnvLine =
    host || portLines.length > 0
      ? "\n- Runtime env vars for dev server URLs are injected into commands: SANDBOX_HOST and SANDBOX_URL_<PORT> (for routable ports)"
      : "";

  return `${baseDetails}${hostLine}${previewLines}${runtimeEnvLine}`;
}

function isVercelState(
  state: SandboxState,
): state is SandboxState & { type: "vercel" } {
  return state.type === "vercel";
}

function isJustBashState(state: SandboxState): state is SandboxState & {
  type: "just-bash";
  workingDirectory?: string;
} {
  return state.type === "just-bash";
}

function isHybridState(state: SandboxState): state is SandboxState & {
  type: "hybrid";
  files?: Record<string, unknown>;
  sandboxId?: string;
  workingDirectory?: string;
} {
  return state.type === "hybrid";
}

export function getWorkingDirectoryFromSandboxConfig(
  sandboxConfig: OpenHarnessSandboxConfig,
): string {
  if (sandboxConfig.kind === "local") {
    return sandboxConfig.workingDirectory;
  }

  const state = sandboxConfig.state;

  if (isVercelState(state)) {
    return DEFAULT_VERCEL_WORKING_DIRECTORY;
  }

  if (isJustBashState(state)) {
    return state.workingDirectory ?? DEFAULT_IN_MEMORY_WORKING_DIRECTORY;
  }

  if (isHybridState(state)) {
    if (state.sandboxId && !state.files) {
      return DEFAULT_VERCEL_WORKING_DIRECTORY;
    }

    return state.workingDirectory ?? DEFAULT_IN_MEMORY_WORKING_DIRECTORY;
  }

  return DEFAULT_IN_MEMORY_WORKING_DIRECTORY;
}

export function getEnvironmentDetailsFromSandboxConfig(
  sandboxConfig: OpenHarnessSandboxConfig,
): string {
  if (sandboxConfig.kind === "local") {
    return LOCAL_ENVIRONMENT_DETAILS;
  }

  const state = sandboxConfig.state;
  if (isVercelState(state)) {
    return appendRuntimeHintsToEnvironmentDetails(
      CLOUD_ENVIRONMENT_DETAILS,
      sandboxConfig.runtimeHints,
    );
  }

  if (isHybridState(state)) {
    if (state.sandboxId && !state.files) {
      return appendRuntimeHintsToEnvironmentDetails(
        CLOUD_ENVIRONMENT_DETAILS,
        sandboxConfig.runtimeHints,
      );
    }
    return IN_MEMORY_ENVIRONMENT_DETAILS;
  }

  return IN_MEMORY_ENVIRONMENT_DETAILS;
}

export function getCurrentBranchFromSandboxConfig(
  sandboxConfig: OpenHarnessSandboxConfig,
): string | undefined {
  if (sandboxConfig.kind === "local") {
    return undefined;
  }

  const source = sandboxConfig.state.source;
  if (!source) {
    return undefined;
  }

  return source.newBranch ?? source.branch;
}

export async function connectSandboxFromConfig(
  sandboxConfig: OpenHarnessSandboxConfig,
): Promise<Sandbox> {
  if (sandboxConfig.kind === "local") {
    return createLocalSandbox(
      sandboxConfig.workingDirectory,
      sandboxConfig.env,
    );
  }

  if (sandboxConfig.options) {
    return connectSandbox(sandboxConfig.state, sandboxConfig.options);
  }

  return connectSandbox(sandboxConfig.state);
}

export function serializeSandboxConfig(
  sandbox: Sandbox,
): OpenHarnessSandboxConfig {
  if (sandbox.type === "local") {
    return {
      kind: "local",
      workingDirectory: sandbox.workingDirectory,
      ...(sandbox.env ? { env: sandbox.env } : {}),
    };
  }

  if (!sandbox.getState) {
    throw new Error(
      `Sandbox type "${sandbox.type}" does not expose serializable state via getState().`,
    );
  }

  const state = sandbox.getState();
  const parsedState = sandboxStateSchema.safeParse(state);
  if (!parsedState.success) {
    throw new Error(
      `Sandbox type "${sandbox.type}" returned invalid state for serialization.`,
    );
  }

  return {
    kind: "state",
    state: parsedState.data,
    ...(sandbox.env ? { options: { env: sandbox.env } } : {}),
  };
}
