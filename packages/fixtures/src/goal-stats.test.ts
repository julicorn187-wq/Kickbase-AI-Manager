import { describe, expect, it } from "vitest";
import { computeGoalStats } from "./goal-stats.js";
import type { TeamMatchInput } from "./types.js";

function match(overrides: Partial<TeamMatchInput> = {}): TeamMatchInput {
  return {
    opponentName: "Opponent",
    kickoffUtc: "2026-08-01T00:00:00Z",
    isHome: true,
    competition: "Bundesliga",
    isFinished: true,
    goalsFor: 1,
    goalsAgainst: 0,
    ...overrides,
  };
}

describe("computeGoalStats", () => {
  it("returns zeros when there are no finished matches with recorded goals", () => {
    const result = computeGoalStats([match({ isFinished: false, goalsFor: undefined, goalsAgainst: undefined })]);
    expect(result).toEqual({ matchesConsidered: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, cleanSheets: 0 });
  });

  it("sums goals for/against and derives the goal difference", () => {
    const result = computeGoalStats([
      match({ kickoffUtc: "2026-08-01T00:00:00Z", goalsFor: 2, goalsAgainst: 1 }),
      match({ kickoffUtc: "2026-08-08T00:00:00Z", goalsFor: 0, goalsAgainst: 0 }),
      match({ kickoffUtc: "2026-08-15T00:00:00Z", goalsFor: 3, goalsAgainst: 2 }),
    ]);

    expect(result).toEqual({ matchesConsidered: 3, goalsFor: 5, goalsAgainst: 3, goalDifference: 2, cleanSheets: 1 });
  });

  it("counts a clean sheet only when goalsAgainst is exactly zero", () => {
    const result = computeGoalStats([
      match({ goalsFor: 1, goalsAgainst: 0 }),
      match({ goalsFor: 4, goalsAgainst: 0 }),
      match({ goalsFor: 0, goalsAgainst: 1 }),
    ]);

    expect(result.cleanSheets).toBe(2);
  });

  it("ignores matches missing goalsFor or goalsAgainst rather than guessing", () => {
    const result = computeGoalStats([
      match({ goalsFor: 1, goalsAgainst: 0 }),
      match({ goalsFor: undefined, goalsAgainst: 2 }),
      match({ goalsFor: 2, goalsAgainst: undefined }),
    ]);

    expect(result.matchesConsidered).toBe(1);
  });

  it("caps at the requested count, most recent first", () => {
    const matches = Array.from({ length: 8 }, (_, i) =>
      match({ kickoffUtc: `2026-08-0${i + 1}T00:00:00Z`, goalsFor: i, goalsAgainst: 0 }),
    );

    const result = computeGoalStats(matches, 5);
    expect(result.matchesConsidered).toBe(5);
    // Most recent 5 (indices 3..7) sum to 3+4+5+6+7 = 25.
    expect(result.goalsFor).toBe(25);
  });
});
