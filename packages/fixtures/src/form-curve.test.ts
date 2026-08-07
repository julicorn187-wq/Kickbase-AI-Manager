import { describe, expect, it } from "vitest";
import { computeFormCurve, getUpcomingMatches } from "./form-curve.js";
import type { TeamMatchInput } from "./types.js";

function match(overrides: Partial<TeamMatchInput> = {}): TeamMatchInput {
  return {
    opponentName: "Opponent",
    kickoffUtc: "2026-08-01T00:00:00Z",
    isHome: true,
    competition: "Bundesliga",
    isFinished: true,
    result: "W",
    ...overrides,
  };
}

describe("computeFormCurve", () => {
  it("returns an empty curve when there are no finished matches", () => {
    const result = computeFormCurve([match({ isFinished: false, result: undefined })]);
    expect(result).toEqual({ matchesConsidered: 0, wins: 0, draws: 0, losses: 0, sequence: [] });
  });

  it("tallies results and orders the sequence most-recent-first", () => {
    const result = computeFormCurve([
      match({ kickoffUtc: "2026-08-01T00:00:00Z", result: "W" }),
      match({ kickoffUtc: "2026-08-08T00:00:00Z", result: "L" }),
      match({ kickoffUtc: "2026-08-15T00:00:00Z", result: "D" }),
    ]);

    expect(result.sequence).toEqual(["D", "L", "W"]);
    expect(result).toMatchObject({ matchesConsidered: 3, wins: 1, draws: 1, losses: 1 });
  });

  it("ignores matches without a recorded result rather than guessing", () => {
    const result = computeFormCurve([
      match({ isFinished: true, result: "W" }),
      match({ isFinished: false, result: undefined }),
    ]);

    expect(result.matchesConsidered).toBe(1);
  });

  it("caps at the requested count", () => {
    const matches = Array.from({ length: 8 }, (_, i) =>
      match({ kickoffUtc: `2026-08-0${i + 1}T00:00:00Z` }),
    );

    expect(computeFormCurve(matches, 5).matchesConsidered).toBe(5);
  });
});

describe("getUpcomingMatches", () => {
  it("returns only unfinished matches, soonest first", () => {
    const result = getUpcomingMatches(
      [
        match({ isFinished: true, kickoffUtc: "2026-07-01T00:00:00Z" }),
        match({ isFinished: false, result: undefined, kickoffUtc: "2026-09-01T00:00:00Z" }),
        match({ isFinished: false, result: undefined, kickoffUtc: "2026-08-01T00:00:00Z" }),
      ],
      5,
    );

    expect(result.map((m) => m.kickoffUtc)).toEqual(["2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z"]);
  });

  it("caps at the requested count", () => {
    const matches = Array.from({ length: 5 }, (_, i) =>
      match({ isFinished: false, result: undefined, kickoffUtc: `2026-08-0${i + 1}T00:00:00Z` }),
    );

    expect(getUpcomingMatches(matches, 3)).toHaveLength(3);
  });
});
