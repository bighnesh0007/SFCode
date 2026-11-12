/**
 * Proves every problem is passable: grades each reference/ solution through
 * the real grader (check-only deploy) in a connected org, and expects
 * "accepted". Also proves each STARTER fails — a problem whose starter already
 * passes tests nothing.
 *
 *   npm run verify:problems -w sfcode-server -- --user <clerk user id> [slug ...]
 *
 * Check-only: nothing is left in the org. Uses that user's stored connection.
 */
import { config } from "../src/config/index.ts";
import { buildContainer, PROBLEMS_DIR } from "../src/container.ts";
import { ChallengeCatalog } from "../src/services/challenges/catalog.ts";
import { buildDeployPackage, interpretDeployResult, isDeployDone } from "../src/services/challenges/grader.ts";
import { SalesforceClient } from "../src/services/salesforce/salesforceClient.ts";

const args = process.argv.slice(2);
const userIdx = args.indexOf("--user");
const userId = userIdx >= 0 ? args[userIdx + 1] : undefined;
const only = args.filter((_a, i) => i !== userIdx && i !== userIdx + 1);
if (!userId) {
  console.error("usage: verify:problems -- --user <clerk user id> [slug ...]");
  process.exit(2);
}

const container = buildContainer();
const { clientId, clientSecret, apiVersion, timeoutMs, redirectUri } = config.salesforce;
if (!container.salesforce || !clientId || !clientSecret) {
  console.error("Salesforce is not configured (server/.env).");
  process.exit(2);
}
const connections = container.salesforce;
const sf = new SalesforceClient({ clientId, clientSecret, apiVersion, timeoutMs, redirectUri });
const catalog = ChallengeCatalog.load(PROBLEMS_DIR);

async function grade(slug: string, sources: Record<string, string>) {
  const challenge = catalog.get(slug);
  if (!challenge) throw new Error(`unknown problem ${slug}`);
  const zip = buildDeployPackage(challenge, sources, apiVersion);
  return connections.withOrg(userId ?? "", async (org) => {
    const id = await sf.deployCheckOnly(org.instanceUrl, org.accessToken, zip, challenge.testClass.name);
    for (;;) {
      await new Promise((r) => setTimeout(r, 3000));
      const raw = await sf.checkDeployStatus(org.instanceUrl, org.accessToken, id);
      if (isDeployDone(raw)) return interpretDeployResult(challenge, raw);
    }
  });
}

let failed = 0;
for (const c of catalog.all().filter((x) => only.length === 0 || only.includes(x.slug))) {
  const ref = await grade(c.slug, c.reference);
  const starter = await grade(c.slug, c.starter);
  const ok = ref.verdict === "accepted" && starter.verdict !== "accepted";
  if (!ok) failed++;
  console.log(
    `${ok ? "✓" : "✗"} ${c.slug.padEnd(28)} reference=${ref.verdict} (${ref.testsPassed}/${ref.testsRun})  starter=${starter.verdict}` +
      (ref.verdict !== "accepted" ? `\n    ${JSON.stringify({ tests: ref.tests.filter((t) => !t.passed), compileErrors: ref.compileErrors, message: ref.message })}` : ""),
  );
}
await container.db?.close();
process.exit(failed ? 1 : 0);
