/**
 * Checks every resource link in the roadmaps resolves (HTTP 200 after redirects).
 * Run before shipping roadmap content: npm run check:roadmap-links -w sfcode-server
 * Not in CI: it depends on Salesforce's sites being up.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = new URL("../roadmaps", import.meta.url).pathname;
const links = new Map<string, string[]>();
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const r = JSON.parse(readFileSync(join(dir, f), "utf8")) as { nodes: { id: string; resources?: { url: string }[] }[] };
  for (const n of r.nodes) for (const res of n.resources ?? []) links.set(res.url, [...(links.get(res.url) ?? []), `${f}#${n.id}`]);
}

let bad = 0;
const urls = [...links.keys()];
for (let i = 0; i < urls.length; i += 6) {
  await Promise.all(
    urls.slice(i, i + 6).map(async (url) => {
      let status = 0;
      try {
        status = (await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "Mozilla/5.0 (sfcode link check)" } })).status;
      } catch {
        status = 0;
      }
      if (status !== 200) {
        bad++;
        console.log(`✗ ${status} ${url}  (${(links.get(url) ?? []).join(", ")})`);
      }
    }),
  );
}
console.log(`${urls.length - bad}/${urls.length} links OK`);
process.exit(bad ? 1 : 0);
