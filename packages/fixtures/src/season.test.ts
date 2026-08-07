import { describe, expect, it } from "vitest";
import { getCurrentBundesligaSeasonYear } from "./season.js";

describe("getCurrentBundesligaSeasonYear", () => {
  it("returns the current year from July onward", () => {
    expect(getCurrentBundesligaSeasonYear(new Date("2026-08-07T00:00:00Z"))).toBe(2026);
    expect(getCurrentBundesligaSeasonYear(new Date("2026-07-01T00:00:00Z"))).toBe(2026);
    expect(getCurrentBundesligaSeasonYear(new Date("2026-12-31T00:00:00Z"))).toBe(2026);
  });

  it("returns the previous year before July", () => {
    expect(getCurrentBundesligaSeasonYear(new Date("2026-01-15T00:00:00Z"))).toBe(2025);
    expect(getCurrentBundesligaSeasonYear(new Date("2026-06-30T00:00:00Z"))).toBe(2025);
  });
});
