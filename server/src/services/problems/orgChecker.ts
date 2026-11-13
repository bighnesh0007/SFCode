/** Runs a draft's hidden tests in someone's own org (check-only: nothing stays), like verify:problems does. */
import { buildDeployPackage, interpretDeployResult, isDeployDone } from "../challenges/grader.ts";
import type { GradingDeps } from "../challenges/challenge.service.ts";
import type { OrgChecker } from "./problemDraft.service.ts";

const POLL_MS = 3000;
const TIMEOUT_MS = 5 * 60_000;

export function makeOrgChecker(deps: GradingDeps, soqlCompare: string): OrgChecker {
  return {
    grade(userId, challenge, sources) {
      const zip = buildDeployPackage(challenge, sources, deps.apiVersion, soqlCompare);
      return deps.connections.withOrg(userId, async (org) => {
        const id = await deps.sf.deployCheckOnly(org.instanceUrl, org.accessToken, zip, challenge.testClass.name);
        const deadline = Date.now() + TIMEOUT_MS;
        for (;;) {
          await new Promise((r) => setTimeout(r, POLL_MS));
          const raw = await deps.sf.checkDeployStatus(org.instanceUrl, org.accessToken, id);
          if (isDeployDone(raw)) return interpretDeployResult(challenge, raw);
          if (Date.now() > deadline) throw new Error("The check timed out after 5 minutes. Try again.");
        }
      });
    },
  };
}
