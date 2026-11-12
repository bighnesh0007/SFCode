import { describe, expect, it } from "vitest";
import { normaliseSalesforceOrigin, resolveLoginUrl } from "../src/services/salesforce/loginUrl.ts";

describe("resolveLoginUrl", () => {
  it("maps the two named environments", () => {
    expect(resolveLoginUrl("production")).toBe("https://login.salesforce.com");
    expect(resolveLoginUrl("sandbox")).toBe("https://test.salesforce.com");
  });

  it("accepts My Domain URLs and normalises them to an origin", () => {
    expect(resolveLoginUrl("https://Acme.my.salesforce.com/some/path")).toBe("https://acme.my.salesforce.com");
    expect(resolveLoginUrl("https://acme--dev.sandbox.my.salesforce.com")).toBe("https://acme--dev.sandbox.my.salesforce.com");
  });

  it.each([
    ["https://orgfarm-ad76ba6cfc.lightning.force.com", "https://orgfarm-ad76ba6cfc.my.salesforce.com"],
    ["https://orgfarm-d61df710ab-dev-ed.develop.lightning.force.com/lightning/o/Task/home", "https://orgfarm-d61df710ab-dev-ed.develop.my.salesforce.com"],
    ["https://acme--uat.sandbox.lightning.force.com", "https://acme--uat.sandbox.my.salesforce.com"],
    ["https://orgfarm-ad76ba6cfc.my.salesforce-setup.com/lightning/setup/SetupOneHome/home", "https://orgfarm-ad76ba6cfc.my.salesforce.com"],
    ["orgfarm-ad76ba6cfc.my.salesforce.com", "https://orgfarm-ad76ba6cfc.my.salesforce.com"],
  ])("maps the URL people paste, %s, to the org's login domain", (input, expected) => {
    expect(resolveLoginUrl(input)).toBe(expected);
  });

  it.each([
    "http://acme.my.salesforce.com",
    "https://evil.com",
    "https://my.salesforce.com.evil.com",
    "https://evilmy.salesforce.com",
    "https://acme.my.salesforce.com:8443",
    "https://user:pw@acme.my.salesforce.com",
    "https://na1.salesforce.com",
    "https://lightning.force.com",
    "https://evil.com/.lightning.force.com",
    "https://acme.lightning.force.com.evil.com",
    "http://acme.lightning.force.com",
    "javascript:alert(1)",
    "",
  ])("rejects %s", (input) => {
    expect(resolveLoginUrl(input)).toBeNull();
  });
});

describe("normaliseSalesforceOrigin", () => {
  it("accepts Salesforce instance hosts", () => {
    expect(normaliseSalesforceOrigin("https://acme.my.salesforce.com")).toBe("https://acme.my.salesforce.com");
    expect(normaliseSalesforceOrigin("https://na1.force.com")).toBe("https://na1.force.com");
  });

  it("rejects look-alikes and bare suffixes", () => {
    expect(normaliseSalesforceOrigin("https://salesforce.com.attacker.io")).toBeNull();
    expect(normaliseSalesforceOrigin("https://attackersalesforce.com")).toBeNull();
    expect(normaliseSalesforceOrigin("https://.salesforce.com")).toBeNull();
    expect(normaliseSalesforceOrigin("http://na1.salesforce.com")).toBeNull();
  });
});
