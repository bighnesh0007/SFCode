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

describe("ChallengeService — what clients can see", () => {
  it("never exposes hidden tests or the reference solution", async () => {
    const { service } = setup();
    for (const c of catalog.all()) {
      const json = JSON.stringify(service.get(c.slug)) + JSON.stringify(await service.list(null));
      expect(json).not.toContain(c.testClass.name);
      for (const ref of Object.values(c.reference)) expect(json).not.toContain(ref);
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
