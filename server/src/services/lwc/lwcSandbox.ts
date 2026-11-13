/**
 * Grades an LWC submission by running the compiled component and its hidden
 * tests in a throwaway Docker container (server/sandbox/lwc-runner). Learner
 * code is untrusted, and Node's vm is not a security boundary, so it never
 * runs in this process: the container has no network, a read-only file
 * system, no capabilities, and memory / CPU / process limits, and is killed
 * after a timeout. See the attack test in tests/lwcSandbox.docker.test.ts.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { logger } from "../../lib/logger.ts";

export interface SandboxResult {
  tests?: { name: string; passed: boolean; message: string | null }[];
  error?: string;
}

const RUN_TIMEOUT_MS = 12_000;
const MAX_OUTPUT = 256_000;

export const SANDBOX_FLAGS = [
  "--network", "none",
  "--read-only",
  "--memory", "256m",
  "--memory-swap", "256m",
  "--cpus", "1",
  "--pids-limit", "64",
  "--cap-drop", "ALL",
  "--security-opt", "no-new-privileges",
  "--user", "node",
];

export class LwcSandbox {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(
    private readonly image: string,
    private readonly maxConcurrent = 3,
    private readonly docker = "docker",
  ) {}

  /** At most `maxConcurrent` containers at once; the rest wait their turn. */
  private async slot(): Promise<() => void> {
    if (this.running >= this.maxConcurrent) await new Promise<void>((r) => this.waiting.push(r));
    this.running++;
    return () => {
      this.running--;
      this.waiting.shift()?.();
    };
  }

  async run(code: string, tests: string): Promise<SandboxResult> {
    const release = await this.slot();
    const name = `sfc-lwc-${randomBytes(6).toString("hex")}`;
    const started = Date.now();
    try {
      return await new Promise<SandboxResult>((resolve) => {
        const child = spawn(this.docker, ["run", "--rm", "-i", "--name", name, ...SANDBOX_FLAGS, this.image], { stdio: ["pipe", "pipe", "pipe"] });
        let out = "";
        let settled = false;
        const finish = (r: SandboxResult) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(r);
        };
        const timer = setTimeout(() => {
          // Killing the docker CLI doesn't stop the container; kill it by name.
          spawn(this.docker, ["kill", name], { stdio: "ignore" }).on("error", () => undefined);
          child.kill("SIGKILL");
          finish({ error: "Grading took too long (over 12 seconds). Check for infinite loops." });
        }, RUN_TIMEOUT_MS);
        child.stdout.on("data", (d: Buffer) => {
          if (out.length < MAX_OUTPUT) out += d.toString("utf8");
        });
        child.on("error", (err) => {
          logger.error({ err }, "lwc sandbox: docker failed to start");
          finish({ error: "LWC grading is unavailable right now." });
        });
        child.on("close", (exit) => {
          if (exit === 137) return finish({ error: "Your component used too much memory (over 256 MB)." });
          try {
            const parsed = JSON.parse(out) as SandboxResult;
            finish(Array.isArray(parsed.tests) || typeof parsed.error === "string" ? parsed : { error: "The grader returned nothing usable." });
          } catch {
            finish({ error: exit === 125 || exit === 127 ? "LWC grading is unavailable right now." : "The grader crashed while running your component." });
          }
        });
        child.stdin.on("error", () => undefined);
        child.stdin.end(JSON.stringify({ code, tests }));
      });
    } finally {
      logger.info({ ms: Date.now() - started }, "lwc sandbox run");
      release();
    }
  }
}
