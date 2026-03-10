import {
  connectSandbox,
  createLocalSandbox,
  type Sandbox,
  type SandboxState,
} from "@open-harness/sandbox";
import { z } from "zod";

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
  }),
]);

export type OpenHarnessSandboxConfig = z.infer<typeof sandboxConfigSchema>;

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
