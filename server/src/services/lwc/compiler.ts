/**
 * Compiles a learner's Lightning Web Component into one self-contained ES
 * module (component + the LWC engine) that the browser runs inside a
 * sandboxed iframe.
 *
 * This ONLY transforms source text — the learner's code never executes on
 * the server. What needs guarding is cost: compiling takes ~1s of CPU, so
 * inputs are size-limited, at most MAX_CONCURRENT compiles run at once, and
 * each has a deadline.
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { rollup } from "rollup";
import lwc from "@lwc/rollup-plugin";
import { AppError } from "../../errors/AppError.ts";
import { ErrorCode } from "../../errors/codes.ts";

export const MAX_FILE_CHARS = 20_000;
export const COMPONENT_NAME = /^[a-z][a-zA-Z0-9]{0,39}$/;
const MAX_CONCURRENT = 2;
const DEADLINE_MS = 15_000;

/**
 * Work dirs must live inside the server package: the LWC resolver finds the
 * engine by walking up to node_modules, and needs a package.json beside its
 * lwc.config.json. `.run/` is gitignored.
 */
const WORK_ROOT = new URL("../../../.run/lwc", import.meta.url).pathname;

export class LwcCompileError extends AppError {
  constructor(message: string) {
    super({ code: ErrorCode.UNPROCESSABLE, message, status: 422, expose: true });
  }
}

export class CompilerBusyError extends AppError {
  constructor() {
    super({ code: ErrorCode.RATE_LIMITED, message: "The component compiler is busy. Try again in a moment.", status: 429, expose: true });
  }
}

export interface LwcSource {
  component: string;
  html: string;
  js: string;
  css: string;
}

let running = 0;

/**
 * Compiled bundles by content hash. Learners re-run unchanged code constantly
 * (Run tests, Preview, Run tests again), and each compile costs ~1s of CPU.
 * In-process LRU: the server is a single instance; a shared cache (Redis)
 * only pays off once there are several. ~350 KB per entry.
 */
const CACHE_LIMIT = 64;
const cache = new Map<string, string>();

function cacheKey(src: LwcSource): string {
  // Lengths are included so field boundaries can't be shifted to collide.
  const parts = [src.component, src.html, src.js, src.css];
  return createHash("sha256").update(parts.map((p) => `${p.length}:${p}`).join("|")).digest("hex");
}

export function lwcCacheSize(): number {
  return cache.size;
}

/** Strip the work-dir path out of compiler messages: it's ours, not the learner's. */
function cleanMessage(message: string, dir: string, component: string): string {
  return message.split(join(dir, "modules", "c", component) + "/").join("").split(dir).join("").slice(0, 2000);
}

export async function compileLwc(src: LwcSource): Promise<string> {
  if (!COMPONENT_NAME.test(src.component)) throw new LwcCompileError("Invalid component name.");
  for (const [kind, text] of [["html", src.html], ["js", src.js], ["css", src.css]] as const) {
    if (text.length > MAX_FILE_CHARS) throw new LwcCompileError(`The ${kind} file is longer than ${MAX_FILE_CHARS} characters.`);
  }
  const key = cacheKey(src);
  const hit = cache.get(key);
  if (hit !== undefined) {
    // Re-insert to mark as most recently used.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  if (running >= MAX_CONCURRENT) throw new CompilerBusyError();
  running++;

  const dir = join(WORK_ROOT, randomBytes(8).toString("hex"));
  try {
    const comp = join(dir, "modules", "c", src.component);
    mkdirSync(comp, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "sfcode-lwc-work", private: true }));
    writeFileSync(join(dir, "lwc.config.json"), JSON.stringify({ modules: [{ dir: "modules" }] }));
    writeFileSync(join(comp, `${src.component}.html`), src.html);
    writeFileSync(join(comp, `${src.component}.js`), src.js);
    if (src.css.trim()) writeFileSync(join(comp, `${src.component}.css`), src.css);
    // The entry exposes the engine's createElement and the component to the
    // page's harness; nothing else from the bundle is reachable.
    writeFileSync(
      join(dir, "entry.js"),
      `import { createElement } from "lwc";\nimport Component from "c/${src.component}";\nwindow.__sfcLwc = { createElement, Component };\n`,
    );

    const build = (async () => {
      const bundle = await rollup({ input: join(dir, "entry.js"), plugins: [lwc({ rootDir: dir })], onwarn: () => undefined });
      try {
        const { output } = await bundle.generate({ format: "esm" });
        return output[0].code;
      } finally {
        await bundle.close();
      }
    })();
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new LwcCompileError("Compiling took too long.")), DEADLINE_MS);
    });
    try {
      const code = await Promise.race([build, deadline]);
      cache.set(key, code);
      if (cache.size > CACHE_LIMIT) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      return code;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new LwcCompileError(cleanMessage(err instanceof Error ? err.message : String(err), dir, src.component));
    } finally {
      clearTimeout(timer);
    }
  } finally {
    running--;
    rmSync(dir, { recursive: true, force: true });
  }
}
