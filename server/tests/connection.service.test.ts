import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "../src/lib/crypto/tokenCipher.ts";
import { OrgNotConnectedError, SalesforceConnectionService } from "../src/services/salesforce/connection.service.ts";
import { SalesforceClient } from "../src/services/salesforce/salesforceClient.ts";
import { fixedClock, json, MemoryConnectionRepository, scriptedFetch } from "./fakes.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const xml = (status: number, body: string) => new Response(body, { status, headers: { "Content-Type": "text/xml" } });

const tokenKey = randomBytes(32).toString("hex");
const stateSecret = "s".repeat(32);
const INSTANCE = "https://acme.my.salesforce.com";

function setup(handler: Parameters<typeof scriptedFetch>[0]) {
  const repo = new MemoryConnectionRepository();
  const clock = fixedClock();
  const fetch = scriptedFetch(handler);
  const client = new SalesforceClient({ clientId: "cid", clientSecret: "csecret", redirectUri: "http://localhost:8100/cb", apiVersion: "62.0", timeoutMs: 5_000, fetch });
  const service = new SalesforceConnectionService(repo, client, { tokenKey, stateSecret }, clock);
  return { repo, clock, fetch, service };
}

/** Salesforce's side of a successful handshake. */
function happyOAuth(call: { url: string }): Response {
  if (call.url.endsWith("/services/oauth2/token")) return json(200, { access_token: "AT1", refresh_token: "RT1", instance_url: INSTANCE });
  if (call.url.endsWith("/services/oauth2/userinfo")) return json(200, { organization_id: "00Dxx", user_id: "005xx", preferred_username: "dev@acme.com" });
  return json(500, {});
}

async function connect(s: ReturnType<typeof setup>) {
  const { authorizeUrl } = await s.service.start("user_1", "production", "/playground/apex");
  const url = new URL(authorizeUrl);
  const state = url.searchParams.get("state") ?? "";
  const redirect = await s.service.complete({ code: "CODE", state });
  return { url, state, redirect };
}

describe("SalesforceConnectionService — connect", () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => {
    s = setup(happyOAuth);
  });

  it("completes PKCE and stores only encrypted tokens", async () => {
    const { url, redirect } = await connect(s);
    expect(url.origin).toBe("https://login.salesforce.com");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(redirect).toBe("/playground/apex?sf=connected");

    // The verifier sent at exchange must hash to the challenge sent at authorize.
    const tokenCall = s.fetch.calls.find((c) => c.url.endsWith("/token"));
    const form = new URLSearchParams(tokenCall?.body);
    const verifier = form.get("code_verifier") ?? "";
    expect(createHash("sha256").update(verifier).digest("base64url")).toBe(url.searchParams.get("code_challenge"));

    const stored = s.repo.connections.get("user_1");
    expect(stored?.orgId).toBe("00Dxx");
    expect(stored?.accessTokenEnc).not.toContain("AT1");
    expect(decryptToken(stored?.refreshTokenEnc ?? "", tokenKey)).toBe("RT1");
    // And the status view never exposes a token.
    expect(JSON.stringify(await s.service.status("user_1"))).not.toMatch(/AT1|RT1|enc:v1/);
  });

  it("refuses to replay a state", async () => {
    const { state } = await connect(s);
    expect(await s.service.complete({ code: "CODE", state })).toContain("reason=expired");
  });

  it("refuses an expired handshake", async () => {
    const { authorizeUrl } = await s.service.start("user_1", "production", "/x");
    s.clock.advance(11 * 60 * 1000);
    const state = new URL(authorizeUrl).searchParams.get("state") ?? "";
    expect(await s.service.complete({ code: "CODE", state })).toContain("reason=invalid_state");
  });

  it("refuses a forged state and falls back to a safe return path", async () => {
    expect(await s.service.complete({ code: "CODE", state: "e30.deadbeef" })).toBe("/settings/org?sf=error&reason=invalid_state");
  });

  it("never redirects off-site, whatever returnTo was asked for", async () => {
    const { authorizeUrl } = await s.service.start("user_1", "production", "//evil.com/steal");
    const state = new URL(authorizeUrl).searchParams.get("state") ?? "";
    expect(await s.service.complete({ code: "CODE", state })).toMatch(/^\/settings\/org\?/);
  });

  it("rejects a non-Salesforce login host before any request is made", async () => {
    await expect(s.service.start("user_1", "https://evil.com", "/")).rejects.toThrow(/My Domain URL/);
    expect(s.fetch.calls).toHaveLength(0);
  });

  it("rejects a token response that names a foreign instance host", async () => {
    const t = setup((c) => (c.url.endsWith("/token") ? json(200, { access_token: "A", refresh_token: "R", instance_url: "https://evil.com" }) : happyOAuth(c)));
    const { redirect } = await connect(t);
    expect(redirect).toContain("reason=exchange");
    expect(t.repo.connections.size).toBe(0);
    expect(t.fetch.calls.some((c) => c.url.startsWith("https://evil.com"))).toBe(false);
  });
});

describe("SalesforceConnectionService — executeAnonymous", () => {
  it("parses a successful run and its debug log", async () => {
    const s = setup((c) => (c.url.includes("/services/Soap/") ? xml(200, fixture("executeAnonymous-success.xml")) : happyOAuth(c)));
    await connect(s);
    const r = await s.service.executeAnonymous("user_1", "System.debug('hi');");
    expect(r).toMatchObject({ compiled: true, success: true, compileProblem: null, line: null });
    expect(r.debugLog).toContain("USER_DEBUG|[2]|DEBUG|Hello & welcome");

    const soap = s.fetch.calls.find((c) => c.url.includes("/services/Soap/"));
    expect(soap?.url).toBe(`${INSTANCE}/services/Soap/s/62.0`);
    expect(soap?.init.redirect).toBe("error");
  });

  it("escapes Apex into the SOAP body", async () => {
    const s = setup((c) => (c.url.includes("/services/Soap/") ? xml(200, fixture("executeAnonymous-success.xml")) : happyOAuth(c)));
    await connect(s);
    await s.service.executeAnonymous("user_1", "String s = '</apex:String><x>&';");
    const body = s.fetch.calls.find((c) => c.url.includes("/Soap/"))?.body;
    expect(body).toContain("&lt;/apex:String&gt;&lt;x&gt;&amp;");
  });

  it("reports compile problems with position", async () => {
    const s = setup((c) => (c.url.includes("/services/Soap/") ? xml(200, fixture("executeAnonymous-compileError.xml")) : happyOAuth(c)));
    await connect(s);
    expect(await s.service.executeAnonymous("user_1", "foo")).toMatchObject({ compiled: false, compileProblem: "Unexpected token 'foo'.", line: 3, column: 14 });
  });

  it("refreshes once on an expired session and persists the new token", async () => {
    let soapCalls = 0;
    const s = setup((c) => {
      if (c.url.includes("/services/Soap/")) return ++soapCalls === 1 ? xml(500, fixture("invalidSession.xml")) : xml(200, fixture("executeAnonymous-success.xml"));
      const form = new URLSearchParams(c.body);
      if (form.get("grant_type") === "refresh_token") return json(200, { access_token: "AT2", instance_url: INSTANCE });
      return happyOAuth(c);
    });
    await connect(s);
    expect((await s.service.executeAnonymous("user_1", "x")).success).toBe(true);
    expect(soapCalls).toBe(2);
    expect(decryptToken(s.repo.connections.get("user_1")?.accessTokenEnc ?? "", tokenKey)).toBe("AT2");
  });

  it("stores a rotated refresh token, so the next refresh uses it", async () => {
    let soapCalls = 0;
    const refreshTokensSent: string[] = [];
    const s = setup((c) => {
      if (c.url.includes("/services/Soap/")) return ++soapCalls % 2 === 1 ? xml(500, fixture("invalidSession.xml")) : xml(200, fixture("executeAnonymous-success.xml"));
      const form = new URLSearchParams(c.body);
      if (form.get("grant_type") === "refresh_token") {
        const sent = form.get("refresh_token") ?? "";
        refreshTokensSent.push(sent);
        // Rotation: each refresh token works once and yields a new one.
        if (sent !== `RT${refreshTokensSent.length}`) return json(400, { error: "invalid_grant" });
        return json(200, { access_token: `AT${refreshTokensSent.length + 1}`, refresh_token: `RT${refreshTokensSent.length + 1}`, instance_url: INSTANCE });
      }
      return happyOAuth(c);
    });
    await connect(s);
    expect((await s.service.executeAnonymous("user_1", "x")).success).toBe(true);
    expect((await s.service.executeAnonymous("user_1", "x")).success).toBe(true);
    expect(refreshTokensSent).toEqual(["RT1", "RT2"]);
    expect(decryptToken(s.repo.connections.get("user_1")?.refreshTokenEnc ?? "", tokenKey)).toBe("RT3");
  });

  it("keeps the connection when a concurrent request already rotated the token", async () => {
    const s = setup((c) => {
      if (c.url.includes("/services/Soap/")) {
        // Only the stale token's session is expired; the rotated one works.
        return c.body.includes("AT-fresh") ? xml(200, fixture("executeAnonymous-success.xml")) : xml(500, fixture("invalidSession.xml"));
      }
      const form = new URLSearchParams(c.body);
      if (form.get("grant_type") === "refresh_token") {
        // Simulate the other request winning the race while ours was in flight.
        const conn = s.repo.connections.get("user_1");
        if (conn) s.repo.connections.set("user_1", { ...conn, accessTokenEnc: encryptToken("AT-fresh", tokenKey), refreshTokenEnc: encryptToken("RT-fresh", tokenKey) });
        return json(400, { error: "invalid_grant" });
      }
      return happyOAuth(c);
    });
    await connect(s);
    expect((await s.service.executeAnonymous("user_1", "x")).success).toBe(true);
    expect(s.repo.connections.has("user_1")).toBe(true);
  });

  it("drops a connection whose refresh token was revoked", async () => {
    const s = setup((c) => {
      if (c.url.includes("/services/Soap/")) return xml(500, fixture("invalidSession.xml"));
      const form = new URLSearchParams(c.body);
      if (form.get("grant_type") === "refresh_token") return json(400, { error: "invalid_grant", error_description: "expired access/refresh token" });
      return happyOAuth(c);
    });
    await connect(s);
    await expect(s.service.executeAnonymous("user_1", "x")).rejects.toBeInstanceOf(OrgNotConnectedError);
    expect(s.repo.connections.has("user_1")).toBe(false);
  });

  it("reports an org that can't run Apex as a 422 the user can act on, not a gateway error", async () => {
    const fault = fixture("invalidSession.xml")
      .replace("sf:INVALID_SESSION_ID", "sf:INVALID_OPERATION")
      .replace(/<faultstring>[^<]*<\/faultstring>/, "<faultstring>INVALID_OPERATION: Apex compilation not enabled for this organization</faultstring>");
    const s = setup((c) => (c.url.includes("/services/Soap/") ? xml(500, fault) : happyOAuth(c)));
    await connect(s);
    await expect(s.service.executeAnonymous("user_1", "x")).rejects.toMatchObject({
      status: 422,
      code: "UNPROCESSABLE",
      expose: true,
      message: expect.stringMatching(/doesn't include Apex.*Developer Edition/s),
    });
  });

  it("passes other Salesforce faults through as 422 with Salesforce's own message", async () => {
    const fault = fixture("invalidSession.xml")
      .replace("sf:INVALID_SESSION_ID", "sf:INSUFFICIENT_ACCESS")
      .replace(/<faultstring>[^<]*<\/faultstring>/, "<faultstring>INSUFFICIENT_ACCESS: you lack Author Apex</faultstring>");
    const s = setup((c) => (c.url.includes("/services/Soap/") ? xml(500, fault) : happyOAuth(c)));
    await connect(s);
    await expect(s.service.executeAnonymous("user_1", "x")).rejects.toMatchObject({ status: 422, message: expect.stringContaining("you lack Author Apex") });
  });

  it("requires a connection", async () => {
    const s = setup(happyOAuth);
    await expect(s.service.executeAnonymous("nobody", "x")).rejects.toBeInstanceOf(OrgNotConnectedError);
  });
});

describe("SalesforceConnectionService — query", () => {
  it("returns flattened rows and the column order", async () => {
    const s = setup((c) =>
      c.url.includes("/services/data/")
        ? json(200, { totalSize: 1, done: true, records: [{ attributes: { type: "Contact" }, Id: "003", Name: "Ada", Account: { attributes: {}, Name: "Acme" } }] })
        : happyOAuth(c),
    );
    await connect(s);
    const r = await s.service.query("user_1", "SELECT Id, Name, Account.Name FROM Contact");
    expect(r).toEqual({ totalSize: 1, columns: ["Id", "Name", "Account.Name"], rows: [{ Id: "003", Name: "Ada", "Account.Name": "Acme" }], truncated: false });
    const call = s.fetch.calls.find((c) => c.url.includes("/services/data/"));
    expect(call?.url).toBe(`${INSTANCE}/services/data/v62.0/query?q=${encodeURIComponent("SELECT Id, Name, Account.Name FROM Contact")}`);
    expect(call?.init.redirect).toBe("error");
  });

  it("turns a malformed query into a 422 with Salesforce's message", async () => {
    const s = setup((c) => (c.url.includes("/services/data/") ? json(400, [{ message: "unexpected token: FORM", errorCode: "MALFORMED_QUERY" }]) : happyOAuth(c)));
    await connect(s);
    await expect(s.service.query("user_1", "SELECT Id FORM Account")).rejects.toMatchObject({ status: 422, message: "unexpected token: FORM" });
  });

  it("flags a result Salesforce split into batches", async () => {
    const s = setup((c) => (c.url.includes("/services/data/") ? json(200, { totalSize: 5000, done: false, records: [{ Id: "1" }] }) : happyOAuth(c)));
    await connect(s);
    expect(await s.service.query("user_1", "SELECT Id FROM Account")).toMatchObject({ totalSize: 5000, truncated: true });
  });
});

describe("SalesforceConnectionService — the learner's own Connected App", () => {
  const app = { clientId: "3MVG9OwnAppConsumerKey1234567890", clientSecret: "OWNSECRET1234567890ABCD" };

  it("uses their app to sign in, keeps the secret encrypted, and refreshes with the same app", async () => {
    let soapCalls = 0;
    const s = setup((c) => {
      if (c.url.includes("/services/Soap/")) return ++soapCalls === 1 ? xml(500, fixture("invalidSession.xml")) : xml(200, fixture("executeAnonymous-success.xml"));
      const form = new URLSearchParams(c.body);
      if (form.get("grant_type") === "refresh_token") return json(200, { access_token: "AT2", instance_url: INSTANCE });
      return happyOAuth(c);
    });
    const { authorizeUrl } = await s.service.start("user_1", "production", "/settings/org", app);
    const url = new URL(authorizeUrl);
    expect(url.searchParams.get("client_id")).toBe(app.clientId);
    await s.service.complete({ code: "CODE", state: url.searchParams.get("state") ?? "" });

    const exchange = new URLSearchParams(s.fetch.calls.find((c) => c.url.endsWith("/token"))?.body);
    expect([exchange.get("client_id"), exchange.get("client_secret")]).toEqual([app.clientId, app.clientSecret]);

    const stored = s.repo.connections.get("user_1");
    expect(stored?.clientId).toBe(app.clientId);
    expect(stored?.clientSecretEnc).not.toContain(app.clientSecret);
    expect(decryptToken(stored?.clientSecretEnc ?? "", tokenKey)).toBe(app.clientSecret);

    const view = await s.service.status("user_1");
    expect(view?.ownApp).toBe(true);
    expect(JSON.stringify(view)).not.toContain(app.clientSecret);

    // An expired session refreshes with the learner's app, never the shared one.
    await s.service.executeAnonymous("user_1", "System.debug(1);");
    const refresh = s.fetch.calls.map((c) => new URLSearchParams(c.body)).find((f) => f.get("grant_type") === "refresh_token");
    expect([refresh?.get("client_id"), refresh?.get("client_secret")]).toEqual([app.clientId, app.clientSecret]);
  });

  it("the shared app stays the default", async () => {
    const s = setup(happyOAuth);
    const { url } = await connect(s);
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(s.repo.connections.get("user_1")).toMatchObject({ clientId: null, clientSecretEnc: null });
    expect((await s.service.status("user_1"))?.ownApp).toBe(false);
  });
});
