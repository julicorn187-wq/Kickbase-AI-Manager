import { describe, expect, it } from "vitest";
import { computeFixtureCongestion } from "./congestion.js";
import type { TeamMatchInput } from "./types.js";

function match(overrides: Partial<TeamMatchInput> = {}): TeamMatchInput {
  return {
    opponentName: "Opponent",
    kickoffUtc: "2026-08-01T00:00:00Z",
    isHome: true,
    competition: "Bundesliga",
    isFinished: false,
    ...overrides,
  };
}

describe("computeFixtureCongestion", () => {
  it("returns no windows when matches are well spaced", () => {
    const result = computeFixtureCongestion([
      match({ kickoffUtc: "2026-08-01T00:00:00Z" }),
      match({ kickoffUtc: "2026-08-15T00:00:00Z" }),
    ]);

    expect(result).toEqual([]);
  });

  it("flags two matches within the window as double burden", () => {
    const result = computeFixtureCongestion([
      match({ kickoffUtc: "2026-08-01T00:00:00Z", competition: "Bundesliga" }),
      match({ kickoffUtc: "2026-08-04T00:00:00Z", competition: "DFB-Pokal" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      matchCount: 2,
      level: "double",
      competitions: ["Bundesliga", "DFB-Pokal"],
    });
  });

  it("flags three matches within the window as triple-plus burden", () => {
    const result = computeFixtureCongestion([
      match({ kickoffUtc: "2026-08-01T00:00:00Z", competition: "Bundesliga" }),
      match({ kickoffUtc: "2026-08-03T00:00:00Z", competition: "Champions League" }),
      match({ kickoffUtc: "2026-08-06T00:00:00Z", competition: "Bundesliga" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ matchCount: 3, level: "triple-plus" });
  });

  it("ignores already-finished matches", () => {
    const result = computeFixtureCongestion([
      match({ kickoffUtc: "2026-08-01T00:00:00Z", isFinished: true }),
      match({ kickoffUtc: "2026-08-03T00:00:00Z", isFinished: true }),
    ]);

    expect(result).toEqual([]);
  });

  it("does not let one cluster's matches leak into the next window", () => {
    const result = computeFixtureCongestion([
      match({ kickoffUtc: "2026-08-01T00:00:00Z" }),
      match({ kickoffUtc: "2026-08-03T00:00:00Z" }),
      // Gap of 10 days from the second match — a separate, non-congested match.
      match({ kickoffUtc: "2026-08-13T00:00:00Z" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.matchCount).toBe(2);
  });
});
