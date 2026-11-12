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
