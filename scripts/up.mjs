#!/usr/bin/env node
/**
 * Run the SFCode stack on this machine (used by the systemd service):
 *
 *     npm run up                 build what changed, start everything, keep it running
 *     npm run up -- --rebuild    rebuild both apps first
 *
 *   postgres  127.0.0.1:5433  docker compose (restart: unless-stopped)
 *   server    127.0.0.1:4100  Express API (server/dist)
 *   client    localhost:8100  Next.js standalone; proxies /backend → server
 *
 * Public traffic for sf.bighnesh.space arrives through DWCode's Cloudflare
 * tunnel (~/.cloudflared/dwcode.yml), which the DWCode service runs. This
 * launcher deliberately does NOT start a tunnel: a second cloudflared on the
 * same config would also serve dwl.bighnesh.space.
 *
 * Migrations are NOT applied here — run `npm run db:migrate -w sfcode-server`
 * deliberately. The launcher refuses to start if the schema is missing.
 *
 * Adapted from dwcode/scripts/up.mjs: same restart/backoff and lock behaviour.
 */
import { spawn, spawnSync } from "node:child_process";
import { cpSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUN = join(ROOT, ".run");
const LOGS = join(RUN, "logs");
mkdirSync(LOGS, { recursive: true });
const REBUILD = process.argv.includes("--rebuild");

const colors = { postgres: 34, server: 35, client: 36, up: 37 };
const say = (name, line) => process.stdout.write(`\x1b[${colors[name] ?? 37}m${name.padEnd(8)}\x1b[0m ${line}\n`);
function fail(message) {
  say("up", `\x1b[31m✗ ${message}\x1b[0m`);
  process.exit(1);
}

// ── single instance ───────────────────────────────────────────────────────────
const LOCK = join(RUN, "up.pid");
if (existsSync(LOCK)) {
  const other = Number(readFileSync(LOCK, "utf8"));
  let alive = false;
  try {
    process.kill(other, 0);
    alive = true;
  } catch {
    // stale lock from a launcher that died without cleaning up
  }
  if (alive) fail(`another launcher is already running (pid ${other}).`);
}
writeFileSync(LOCK, String(process.pid));
process.on("exit", () => {
  try {
    // Only our own lock file, and only if it still names this process.
    if (readFileSync(LOCK, "utf8") === String(process.pid)) rmSync(LOCK);
  } catch {
    // already gone
  }
});

// ── env ───────────────────────────────────────────────────────────────────────
/** Minimal dotenv: KEY=VALUE, # comments, optional quotes. No expansion. */
function readEnv(path) {
  if (!existsSync(path)) fail(`${path} is missing — see README "Run it locally".`);
  const out = {};
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}
const serverEnv = readEnv(join(ROOT, "server", ".env"));
const clientEnv = readEnv(join(ROOT, "client", ".env.local"));

// ── postgres ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const compose = (...argv) => spawnSync("docker", ["compose", ...argv], { cwd: ROOT, encoding: "utf8" });

say("postgres", "$ docker compose up -d");
// Right after boot the docker daemon may still be starting; give it a minute.
for (let i = 0; compose("up", "-d").status !== 0; i++) {
  if (i >= 30) fail("docker compose up failed — is the docker daemon running?");
  await sleep(2000);
}
for (let i = 0; compose("exec", "-T", "postgres", "pg_isready", "-U", "sfcode").status !== 0; i++) {
  if (i >= 60) fail("postgres did not become ready");
  await sleep(1000);
}
const schema = compose("exec", "-T", "postgres", "psql", "-U", "sfcode", "-tAc", "select to_regclass('public.salesforce_connections') is not null");
if (schema.stdout.trim() !== "t") fail("database schema missing — run: npm run db:migrate -w sfcode-server");
say("postgres", "\x1b[32mhealthy\x1b[0m");

// ── build what changed ────────────────────────────────────────────────────────
function newestMtime(dir, skip = /node_modules|\.next|dist|\.run/) {
  let newest = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (skip.test(e.name)) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else newest = Math.max(newest, statSync(p).mtimeMs);
    }
  };
  walk(dir);
  return newest;
}
const mtime = (p) => (existsSync(p) ? statSync(p).mtimeMs : 0);
function build(name, workspace) {
  say(name, `$ npm run build -w ${workspace}`);
  if (spawnSync("npm", ["run", "build", "-w", workspace], { cwd: ROOT, stdio: "inherit" }).status !== 0) fail(`${name} build failed`);
}

const serverEntry = join(ROOT, "server", "dist", "server.js");
if (REBUILD || mtime(serverEntry) < newestMtime(join(ROOT, "server", "src"))) build("server", "sfcode-server");

// NEXT_PUBLIC_* and the /backend rewrite target are fixed at build time, so a
// changed .env.local also forces a client rebuild.
const standalone = join(ROOT, "client", ".next", "standalone", "client", "server.js");
if (REBUILD || mtime(standalone) < Math.max(newestMtime(join(ROOT, "client")), mtime(join(ROOT, "client", ".env.local")))) {
  build("client", "sfcode-client");
}
// Standalone output omits static assets. Copied unconditionally because a build
// interrupted before this step left DWCode serving pages with no CSS/JS.
cpSync(join(ROOT, "client", ".next", "static"), join(ROOT, "client", ".next", "standalone", "client", ".next", "static"), { recursive: true });
if (existsSync(join(ROOT, "client", "public"))) {
  cpSync(join(ROOT, "client", "public"), join(ROOT, "client", ".next", "standalone", "client", "public"), { recursive: true });
}

// ── processes ─────────────────────────────────────────────────────────────────
async function httpOk(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000), redirect: "manual" });
    return r.status < 500;
  } catch {
    return false;
  }
}

const services = [
  {
    name: "server",
    argv: [serverEntry],
    env: { ...serverEnv, NODE_ENV: "production", HOST: "127.0.0.1", API_PORT: "4100", LOG_PRETTY: "false" },
    health: () => httpOk("http://127.0.0.1:4100/health"),
  },
  {
    name: "client",
    argv: [standalone],
    cwd: dirname(standalone),
    // "localhost", not 127.0.0.1: Next calls itself at localhost (::1 first). Learned in DWCode.
    env: { ...clientEnv, PORT: "8100", HOSTNAME: "localhost", NODE_ENV: "production" },
    health: () => httpOk("http://localhost:8100/"),
  },
];

// Refuse to start on top of something already listening (e.g. `npm run dev`).
for (const [name, url] of [["server", "http://127.0.0.1:4100/health"], ["client", "http://localhost:8100/"]]) {
  if (await httpOk(url)) fail(`${name} port is already in use (${url}). Stop the other copy first.`);
}

const children = new Map();
let stopping = false;

function start(svc) {
  const log = createWriteStream(join(LOGS, `${svc.name}.log`), { flags: "a" });
  const child = spawn(process.execPath, svc.argv, { cwd: svc.cwd ?? ROOT, env: { ...process.env, ...svc.env }, stdio: ["ignore", "pipe", "pipe"] });
  const pipe = (stream) => {
    let buf = "";
    stream.on("data", (d) => {
      log.write(d);
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        say(svc.name, buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on("exit", (code, signal) => {
    children.delete(svc.name);
    log.end();
    if (stopping) return;
    svc.crashes = (svc.crashes ?? []).filter((t) => Date.now() - t < 60_000).concat(Date.now());
    if (svc.crashes.length >= 5) {
      say(svc.name, "crashed 5 times in a minute — stopping the stack");
      void shutdown(1);
      return;
    }
    const delay = 1000 * 2 ** (svc.crashes.length - 1);
    say(svc.name, `exited (${signal ?? code}); restarting in ${delay} ms`);
    setTimeout(() => !stopping && start(svc), delay);
  });
  children.set(svc.name, child);
}

async function waitHealthy(svc, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await svc.health()) return;
    await sleep(500);
  }
  say(svc.name, "did not become healthy in time");
  await shutdown(1);
}

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  say("up", "stopping…");
  for (const svc of [...services].reverse()) {
    const child = children.get(svc.name);
    if (!child) continue;
    child.kill("SIGTERM");
    await new Promise((r) => {
      const t = setTimeout(() => {
        child.kill("SIGKILL");
        r();
      }, 12_000);
      child.once("exit", () => {
        clearTimeout(t);
        r();
      });
    });
    say(svc.name, "stopped");
  }
  // Postgres is left running: docker owns its lifecycle (restart: unless-stopped).
  process.exit(code);
}
process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));

for (const svc of services) {
  start(svc);
  await waitHealthy(svc);
  say(svc.name, "\x1b[32mhealthy\x1b[0m");
}
say("up", "\x1b[32m✓ all up\x1b[0m — http://localhost:8100  ·  https://sf.bighnesh.space (via DWCode's tunnel)");
