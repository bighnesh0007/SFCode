/**
 * Debug-log helpers. A USER_DEBUG line looks like
 *   `12:00:00.12 (1234567)|USER_DEBUG|[3]|DEBUG|message`
 * and a message may continue over following lines until the next timestamped event.
 */
const EVENT_LINE = /^\d{2}:\d{2}:\d{2}\.\d+ \(\d+\)\|/;

export interface UserDebugEntry {
  line: number | null;
  level: string;
  message: string;
}

export function extractUserDebug(log: string): UserDebugEntry[] {
  const out: UserDebugEntry[] = [];
  let current: UserDebugEntry | null = null;
  for (const raw of log.split("\n")) {
    if (EVENT_LINE.test(raw)) {
      current = null;
      const parts = raw.split("|");
      if (parts[1] === "USER_DEBUG") {
        const lineNo = Number(/\[(\d+)\]/.exec(parts[2] ?? "")?.[1]);
        current = { line: Number.isFinite(lineNo) ? lineNo : null, level: parts[3] ?? "DEBUG", message: parts.slice(4).join("|") };
        out.push(current);
      }
    } else if (current) {
      current.message += `\n${raw}`;
    }
  }
  return out;
}

export interface LimitUsage {
  name: string;
  used: number;
  max: number;
}

/**
 * Reads the `LIMIT_USAGE_FOR_NS|(default)|` block, whose following lines look like
 * `  Number of SOQL queries: 2 out of 100`. Only the default namespace is shown:
 * that's the learner's own code.
 */
export function extractLimits(log: string): LimitUsage[] {
  const out: LimitUsage[] = [];
  let inBlock = false;
  for (const raw of log.split("\n")) {
    if (EVENT_LINE.test(raw)) {
      inBlock = raw.includes("|LIMIT_USAGE_FOR_NS|(default)|");
      continue;
    }
    if (!inBlock) continue;
    const m = /^\s*(.+?):\s*(\d+)\s+out of\s+(\d+)/.exec(raw);
    if (m) out.push({ name: m[1] ?? "", used: Number(m[2]), max: Number(m[3]) });
  }
  // A transaction logs the block more than once; the last one is the final total.
  const last = new Map<string, LimitUsage>();
  for (const l of out) last.set(l.name, l);
  return [...last.values()];
}
