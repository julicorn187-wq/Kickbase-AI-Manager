import { describe, expect, it } from "vitest";
import { computePlayerValueScore } from "./player-score.js";
import type { PlayerScoreInput } from "./types.js";

function input(overrides: Partial<PlayerScoreInput> = {}): PlayerScoreInput {
  return {
    id: "1",
    name: "Harry Kane",
    position: "Sturm",
    teamName: "FC Bayern München",
    marketValue: 68_000_000,
    averagePoints: 216,
    averagePointsSource: "previous-season",
    gamesConsidered: 31,
    ...overrides,
  };
}

describe("computePlayerValueScore", () => {
  it("scores compositeScore as averagePoints when there is no matchup data", () => {
    const result = computePlayerValueScore(input());
    expect(result.adjustmentPct).toBe(0);
    expect(result.compositeScore).toBe(216);
  });

  it("applies the matchup adjustment to compositeScore", () => {
    const result = computePlayerValueScore(input({ isHome: true }));
    expect(result.adjustmentPct).toBeGreaterThan(0);
    expect(result.compositeScore).toBeGreaterThan(216);
    expect(result.compositeScore).toBeCloseTo(216 * (1 + result.adjustmentPct), 5);
  });

  it("includes the average-points source and sample size in the rationale", () => {
    const result = computePlayerValueScore(input());
    expect(result.rationale[0]).toMatch(/previous-season/i);
    expect(result.rationale[0]).toContain("31 matches");
  });

  it("passes through BaseXI's own signals for display without scoring them", () => {
    const withoutSignals = computePlayerValueScore(input());
    const withSignals = computePlayerValueScore(
      input({ baseXiMomentum: "dark_green", baseXiNextMatchDifficulty: 2 }),
    );

    expect(withoutSignals.compositeScore).toBe(withSignals.compositeScore);
    expect(withSignals.baseXiMomentum).toBe("dark_green");
    expect(withSignals.baseXiNextMatchDifficulty).toBe(2);
    expect(withoutSignals.baseXiMomentum).toBeUndefined();
  });

  it("preserves identity fields unchanged", () => {
    const result = computePlayerValueScore(input());
    expect(result).toMatchObject({
      id: "1",
      name: "Harry Kane",
      position: "Sturm",
      teamName: "FC Bayern München",
      marketValue: 68_000_000,
    });
  });
});
