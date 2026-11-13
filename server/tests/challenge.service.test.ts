import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { PROBLEMS_DIR } from "../src/container.ts";
import { ChallengeCatalog } from "../src/services/challenges/catalog.ts";
import { ChallengeService, CHECK_INTERVAL_MS, GRADE_TIMEOUT_MS, START_TIMEOUT_MS } from "../src/services/challenges/challenge.service.ts";
import { SalesforceConnectionService } from "../src/services/salesforce/connection.service.ts";
import { SalesforceClient } from "../src/services/salesforce/salesforceClient.ts";
import { encryptToken } from "../src/lib/crypto/tokenCipher.ts";
import { fixedClock, MemoryConnectionRepository, MemorySubmissionRepository, scriptedFetch } from "./fakes.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const xml = (body: string) => new Response(body, { status: 200, headers: { "Content-Type": "text/xml" } });
const tokenKey = randomBytes(32).toString("hex");
const catalog = ChallengeCatalog.load(PROBLEMS_DIR);
const RATING = { SfcAccountRating: "trigger SfcAccountRating on Account (before insert) {}" };

function setup(opts: { statusFixture?: () => string } = {}) {
  const clock = fixedClock();
  const conns = new MemoryConnectionRepository();
  const subs = new MemorySubmissionRepository(clock);
  const fetch = scriptedFetch((call) => {
    if (call.body.includes("<met:deploy>")) return xml(fixture("deploy-started.xml"));
    if (call.body.includes("<met:checkDeployStatus>")) return xml(fixture(opts.statusFixture?.() ?? "deployStatus-accepted.xml"));
    return new Response("unexpected", { status: 500 });
  });
  const sf = new SalesforceClient({ clientId: "c", clientSecret: "s", redirectUri: "r", apiVersion: "62.0", timeoutMs: 1000, fetch });
  const connections = new SalesforceConnectionService(conns, sf, { tokenKey, stateSecret: "x".repeat(32) }, clock);
  const service = new ChallengeService(catalog, subs, { connections, sf, apiVersion: "62.0" }, clock);
  const connect = (userId: string, orgId = "00Dorg") =>
    conns.upsert({ userId, orgId, sfUserId: "005", username: "u@x.com", instanceUrl: "https://acme.my.salesforce.com", loginUrl: "https://login.salesforce.com", accessTokenEnc: encryptToken("AT", tokenKey), refreshTokenEnc: encryptToken("RT", tokenKey) });
  return { clock, subs, fetch, service, connect, conns };
}

describe("community problems in the catalog", () => {
  it("are flagged in the list and credit their author; built-ins have no author", async () => {
    const own = ChallengeCatalog.load(PROBLEMS_DIR);
    const base = own.get("text-utils");
    if (!base) throw new Error("fixture missing");
    own.add({ ...base, slug: "community-one", order: own.nextCommunityOrder(), authorId: "bud", files: [{ name: "SfcCommunityOne", type: "class" }], testClass: { name: "SfcCommunityOneTest", source: base.testClass.source } });
    const service = new ChallengeService(own, new MemorySubmissionRepository(fixedClock()), undefined, fixedClock());
    service.setAuthorLookup((id) => Promise.resolve(id === "bud" ? { handle: "ann", displayName: "Ann" } : null));
    const list = await service.list(null, "apex");
    expect(list.find((c) => c.slug === "community-one")?.community).toBe(true);
    expect(list.find((c) => c.slug === "text-utils")?.community).toBe(false);
    expect(await service.author("community-one")).toEqual({ handle: "ann", displayName: "Ann" });
    expect(await service.author("text-utils")).toBeNull();
    expect(list.at(-1)?.slug).toBe("community-one"); // community problems sort after built-ins
  });

  it("the catalog refuses a community problem reusing a built-in Apex name, and removes cleanly", () => {
    const own = ChallengeCatalog.load(PROBLEMS_DIR);
    const base = own.get("text-utils");
    if (!base) throw new Error("fixture missing");
    const clash = { ...base, slug: "copycat", order: own.nextCommunityOrder() };
    expect(own.conflict(clash)).toMatch(/SfcTextUtils is also used by text-utils/);
    expect(() => own.add(clash)).toThrow();
    own.remove("text-utils");
    expect(own.conflict(clash)).toBeNull();
  });
});

describe("ChallengeService — what clients can see", () => {
  it("never exposes hidden tests or the reference solution", async () => {
    const { service } = setup();
    for (const c of catalog.all()) {
      const json = JSON.stringify(service.get(c.slug)) + JSON.stringify(await service.list(null));
      expect(json).not.toContain(c.testClass.name);
      expect(json).not.toContain("sfcAssertSameRows");
      // Compare in JSON-escaped form: multi-line source with quotes appears in
      // the response as \n and \" — matching the raw text could never fail.
      // Empty reference files (a component with no CSS) have nothing to leak.
      for (const ref of Object.values(c.reference).filter((r) => r.trim() !== "")) {
        expect(json, `${c.slug} leaks its reference solution`).not.toContain(JSON.stringify(ref).slice(1, -1));
      }
      if (c.lwc) {
        // Hidden-only test names (the hidden set also contains the visible ones).
        const names = (src: string) => [...src.matchAll(/name: "([^"]+)"/g)].map((m) => m[1] ?? "");
        const hiddenOnly = names(c.lwc.hiddenTests).filter((n) => !names(c.lwc?.tests ?? "").includes(n));
        expect(hiddenOnly.length, `${c.slug} has no hidden-only tests`).toBeGreaterThan(0);
        for (const n of hiddenOnly) expect(json, `${c.slug} leaks hidden test "${n}"`).not.toContain(n);
      }
    }
  });

  it("serves starter code and statement", () => {
    const view = setup().service.get("won-revenue-rollup");
    expect(view.files.map((f) => f.fileName)).toEqual(["SfcRevenueRollup.trigger", "SfcRevenueRollupHandler.cls"]);
    expect(view.statement).toContain("AnnualRevenue");
  });

  it("browses without Salesforce configured, but refuses to grade", async () => {
    const clock = fixedClock();
    const browseOnly = new ChallengeService(catalog, new MemorySubmissionRepository(clock), undefined, clock);
    expect((await browseOnly.list(null)).length).toBe(catalog.all().length);
    await expect(browseOnly.submit("u1", "account-rating-default", RATING)).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });

  it("filters the list by track", async () => {
    const { service } = setup();
    expect((await service.list(null, "soql")).every((c) => c.track === "soql")).toBe(true);
    expect((await service.list(null, "soql")).length).toBe(9);
    expect((await service.list(null, "apex")).length).toBe(11);
    expect((await service.list(null, "debug")).length).toBe(8);
    expect((await service.list(null, "flow")).length).toBe(6);
    expect((await service.list(null, "lwc")).length).toBe(6);
    expect((await service.list(null)).length).toBe(40);
  });

  it("404s unknown problems", () => {
    expect(() => setup().service.get("nope")).toThrow(/not found/i);
  });
});

describe("ChallengeService — submitting and grading", () => {
  it("deploys check-only with the user's code and the hidden tests, then grades on poll", async () => {
    const s = setup();
    await s.connect("u1");
    const sub = await s.service.submit("u1", "account-rating-default", RATING);
    expect(sub.status).toBe("running");

    const deploy = s.fetch.calls.find((c) => c.body.includes("<met:deploy>"));
    expect(deploy?.url).toBe("https://acme.my.salesforce.com/services/Soap/m/62.0");
    expect(deploy?.body).toContain("<met:checkOnly>true</met:checkOnly>");
    expect(deploy?.body).toContain("<met:runTests>SfcAccountRatingTest</met:runTests>");
    const zipB64 = /<met:ZipFile>([^<]+)<\/met:ZipFile>/.exec(deploy?.body ?? "")?.[1] ?? "";
    const zip = unzipSync(Buffer.from(zipB64, "base64"));
    expect(strFromU8(zip["triggers/SfcAccountRating.trigger"] ?? new Uint8Array())).toBe(RATING.SfcAccountRating);

    const graded = await s.service.view("u1", sub.id);
    expect(graded.status).toBe("accepted");
    expect(graded.result?.testsPassed).toBe(4);
    expect(await s.service.list("u1")).toContainEqual(expect.objectContaining({ slug: "account-rating-default", progress: "solved" }));
  });

  it("stays running until Salesforce says done, and rate-limits status checks", async () => {
    let fixtureName = "deployStatus-inProgress.xml";
    const s = setup({ statusFixture: () => fixtureName });
    await s.connect("u1");
    const sub = await s.service.submit("u1", "account-rating-default", RATING);

    expect((await s.service.view("u1", sub.id)).status).toBe("running");
    await s.service.view("u1", sub.id); // within CHECK_INTERVAL_MS: must not hit Salesforce again
    expect(s.fetch.calls.filter((c) => c.body.includes("checkDeployStatus"))).toHaveLength(1);

    fixtureName = "deployStatus-wrongAnswer.xml";
    s.clock.advance(CHECK_INTERVAL_MS + 1);
    const done = await s.service.view("u1", sub.id);
    expect(done.status).toBe("wrong_answer");
    expect(await s.service.list("u1")).toContainEqual(expect.objectContaining({ slug: "account-rating-default", progress: "attempted" }));
  });

  it("allows one running submission per user", async () => {
    const s = setup({ statusFixture: () => "deployStatus-inProgress.xml" });
    await s.connect("u1");
    await s.service.submit("u1", "account-rating-default", RATING);
    await expect(s.service.submit("u1", "account-rating-default", RATING)).rejects.toThrow(/already have a submission/);
  });

  it("grades a flow problem with the hidden tests only — never a submitted flow", async () => {
    const s = setup();
    await s.connect("u1");
    const sub = await s.service.submit("u1", "flow-won-next-step", {});
    expect(sub.status).toBe("running");
    const deploy = s.fetch.calls.find((c) => c.body.includes("<met:deploy>"));
    const zipB64 = /<met:ZipFile>([^<]+)<\/met:ZipFile>/.exec(deploy?.body ?? "")?.[1] ?? "";
    const names = Object.keys(unzipSync(Buffer.from(zipB64, "base64"))).sort();
    expect(names).toEqual(["classes/SfcFlowWonNextStepTest.cls", "classes/SfcFlowWonNextStepTest.cls-meta.xml", "package.xml"]);
    // A learner can't smuggle a flow (or anything) into the deploy.
    await expect(s.service.submit("u2", "flow-won-next-step", { SFC_Opportunity_Won_Next_Step: "<Flow/>" })).rejects.toThrow(/exactly these files/);
  });

  it("serves an LWC problem's component files and browser tests, but never its reference", () => {
    const view = setup().service.get("lwc-contact-filter");
    expect(view.files.map((f) => f.fileName)).toEqual(["contactFilter.html", "contactFilter.js", "contactFilter.css"]);
    expect(view.lwc?.tests).toContain("const tests");
    expect(JSON.stringify(view)).not.toContain("handleSearch(event)");
  });

  it("refuses to submit an LWC problem to the org grader", async () => {
    const s = setup();
    await s.connect("u1");
    await expect(s.service.submit("u1", "lwc-click-counter", {})).rejects.toThrow(/graded in our sandbox/);
    expect(s.fetch.calls).toHaveLength(0);
  });

  it("exposes the flow to build, but not its reference metadata", () => {
    const view = setup().service.get("flow-key-account-task");
    expect(view.flow).toEqual({ apiName: "SFC_Key_Account_Review", kind: "record-triggered" });
    expect(JSON.stringify(view)).not.toContain("recordCreates");
  });

  it("requires exactly the problem's files", async () => {
    const s = setup();
    await s.connect("u1");
    await expect(s.service.submit("u1", "won-revenue-rollup", { SfcRevenueRollup: "x" })).rejects.toThrow(/exactly these files/);
    await expect(s.service.submit("u1", "account-rating-default", { ...RATING, SfcExtra: "x" })).rejects.toThrow(/exactly these files/);
    expect(s.fetch.calls).toHaveLength(0);
  });

  it("requires a connected org", async () => {
    await expect(setup().service.submit("u1", "account-rating-default", RATING)).rejects.toThrow(/Connect a Salesforce org/);
  });

  it("hides other users' submissions", async () => {
    const s = setup();
    await s.connect("u1");
    const sub = await s.service.submit("u1", "account-rating-default", RATING);
    await expect(s.service.view("u2", sub.id)).rejects.toThrow(/not found/i);
  });

  it("errors out when the org changed mid-grade", async () => {
    const s = setup({ statusFixture: () => "deployStatus-inProgress.xml" });
    await s.connect("u1", "00Dfirst");
    const sub = await s.service.submit("u1", "account-rating-default", RATING);
    await s.connect("u1", "00Dsecond");
    const v = await s.service.view("u1", sub.id);
    expect(v.status).toBe("error");
    expect(s.fetch.calls.filter((c) => c.body.includes("checkDeployStatus"))).toHaveLength(0);
  });

  it("times out a deploy that never finishes, freeing the user", async () => {
    const s = setup({ statusFixture: () => "deployStatus-inProgress.xml" });
    await s.connect("u1");
    const sub = await s.service.submit("u1", "account-rating-default", RATING);
    s.clock.advance(GRADE_TIMEOUT_MS + 1);
    expect((await s.service.view("u1", sub.id)).status).toBe("error");
    await expect(s.service.submit("u1", "account-rating-default", RATING)).resolves.toMatchObject({ status: "running" });
  });

  it("releases a submission whose deploy never started", async () => {
    const s = setup();
    await s.connect("u1");
    const stuck = await s.subs.createRunning({ userId: "u1", problemSlug: "text-utils", orgId: "00Dorg", files: {} });
    if (!stuck) throw new Error("setup");
    expect((await s.service.view("u1", stuck.id)).status).toBe("running");
    s.clock.advance(START_TIMEOUT_MS + 1);
    expect((await s.service.view("u1", stuck.id)).status).toBe("error");
  });

  it("records a deploy that Salesforce refuses as an error and frees the user", async () => {
    const s = setup();
    await s.connect("u1");
    const refusing = new SalesforceClient({
      clientId: "c", clientSecret: "s", redirectUri: "r", apiVersion: "62.0", timeoutMs: 1000,
      fetch: () => Promise.resolve(xml(fixture("invalidSession.xml").replaceAll("INVALID_SESSION_ID", "INSUFFICIENT_ACCESS"))),
    });
    const connections = new SalesforceConnectionService(s.conns, refusing, { tokenKey, stateSecret: "x".repeat(32) }, s.clock);
    const failing = new ChallengeService(catalog, s.subs, { connections, sf: refusing, apiVersion: "62.0" }, s.clock);
    const sub = await failing.submit("u1", "account-rating-default", RATING);
    expect(sub.status).toBe("error");
    expect(sub.result?.message).toContain("INSUFFICIENT_ACCESS");
    await expect(s.service.submit("u1", "account-rating-default", RATING)).resolves.toMatchObject({ status: "running" });
  });
});
