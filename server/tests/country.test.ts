import { describe, expect, it } from "vitest";
import { aboutBody } from "../src/validation/community.schema.ts";
import { isCountryCode } from "../src/domain/countries.ts";

describe("country codes", () => {
  it("accepts real ISO 3166 regions and rejects made-up ones", () => {
    expect(["IN", "DE", "US", "BR", "JP"].every(isCountryCode)).toBe(true);
    expect(["ZZ", "XX", "QO", "EU", "UN", "in", "IND", ""].some(isCountryCode)).toBe(false);
  });
  it("country is optional on the About form; null clears it", () => {
    const base = { bio: "", company: "", location: "", trailheadUrl: "", linkedinUrl: "", githubUrl: "", certifications: [], openToWork: false };
    expect(aboutBody.safeParse(base).success).toBe(true);
    expect(aboutBody.safeParse({ ...base, country: null }).success).toBe(true);
    expect(aboutBody.safeParse({ ...base, country: "IN" }).success).toBe(true);
    expect(aboutBody.safeParse({ ...base, country: "ZZ" }).success).toBe(false);
  });
});
