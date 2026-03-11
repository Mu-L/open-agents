import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

let metadataCallCount = 0;
let lastStartCommandEnv: Record<string, string> | undefined;

mock.module("./rest-client", () => {
  class MockVercelApiError extends Error {
    readonly status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.name = "VercelApiError";
      this.status = status;
    }
  }

  class MockVercelRestClient {
    async getSandboxMetadata({ sandboxId }: { sandboxId: string }): Promise<{
      routes: Array<{ url: string; subdomain: string; port: number }>;
      requestedStopAt: number;
    }> {
      metadataCallCount += 1;

      return {
        routes: [
          {
            url: `https://${sandboxId}-3000.vercel.run`,
            subdomain: `${sandboxId}-3000`,
            port: 3000,
          },
        ],
        requestedStopAt: 123_456,
      };
    }

    async startCommand({
      sandboxId,
      command,
      args,
      env,
    }: {
      sandboxId: string;
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }): Promise<{
      id: string;
      name: string;
      args: string[];
      cwd: string;
      sandboxId: string;
      exitCode: number | null;
      startedAt: number;
    }> {
      lastStartCommandEnv = env;

      return {
        id: "cmd-1",
        name: command,
        args: args ?? [],
        cwd: "/vercel/sandbox",
        sandboxId,
        exitCode: null,
        startedAt: Date.now(),
      };
    }

    async waitForCommand({
      sandboxId,
      commandId,
    }: {
      sandboxId: string;
      commandId: string;
    }): Promise<{
      id: string;
      name: string;
      args: string[];
      cwd: string;
      sandboxId: string;
      exitCode: number | null;
      startedAt: number;
    }> {
      return {
        id: commandId,
        name: "bash",
        args: [],
        cwd: "/vercel/sandbox",
        sandboxId,
        exitCode: 0,
        startedAt: Date.now(),
      };
    }

    async collectCommandLogs(): Promise<{
      stdout: string;
      stderr: string;
      both: string;
    }> {
      return {
        stdout: "",
        stderr: "",
        both: "ok",
      };
    }

    async killCommand(): Promise<void> {}
  }

  return {
    getVercelAuthContextFromOidcToken: () => ({
      token: "token",
      teamId: "team_test",
    }),
    isSandboxUnavailableError: () => false,
    VercelApiError: MockVercelApiError,
    VercelRestClient: MockVercelRestClient,
  };
});

let statelessSandboxModule: typeof import("./stateless-sandbox");

beforeAll(async () => {
  statelessSandboxModule = await import("./stateless-sandbox");
});

beforeEach(() => {
  metadataCallCount = 0;
  lastStartCommandEnv = undefined;
});

describe("StatelessVercelSandbox metadata", () => {
  test("includes sandbox host and preview URLs in environment details", async () => {
    const sandbox = new statelessSandboxModule.StatelessVercelSandbox({
      sandboxId: "sbx-test",
      ports: [3000],
    });

    await sandbox.refreshMetadata();

    expect(metadataCallCount).toBe(1);
    expect(sandbox.environmentDetails).toContain(
      "Sandbox host: sbx-test-3000.vercel.run",
    );
    expect(sandbox.environmentDetails).toContain(
      "Port 3000: https://sbx-test-3000.vercel.run",
    );
  });

  test("injects runtime preview env vars into command execution", async () => {
    const sandbox = new statelessSandboxModule.StatelessVercelSandbox({
      sandboxId: "sbx-test",
      ports: [3000],
    });

    await sandbox.refreshMetadata();
    await sandbox.exec("echo test", "/vercel/sandbox", 5_000);

    expect(lastStartCommandEnv?.SANDBOX_HOST).toBe("sbx-test-3000.vercel.run");
    expect(lastStartCommandEnv?.SANDBOX_URL_3000).toBe(
      "https://sbx-test-3000.vercel.run",
    );
  });
});
