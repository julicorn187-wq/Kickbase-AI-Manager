import { describe, expect, it } from "vitest";
import { computeConcentrationWarnings } from "./concentration.js";
import type { PlayerValueScore } from "./types.js";

function player(overrides: Partial<PlayerValueScore> = {}): PlayerValueScore {
  return {
    id: "1",
    name: "Player",
    position: "Sturm",
    teamName: "Team",
    marketValue: 1_000_000,
    averagePoints: 100,
    averagePointsSource: "previous-season",
    gamesConsidered: 30,
    adjustmentPct: 0,
    compositeScore: 100,
    rationale: [],
    ...overrides,
  };
}

describe("computeConcentrationWarnings", () => {
  it("flags a club with more than 2 starters", () => {
    const starters = [
      player({ id: "1", teamName: "FC Bayern München" }),
      player({ id: "2", teamName: "FC Bayern München" }),
      player({ id: "3", teamName: "FC Bayern München" }),
      player({ id: "4", teamName: "Other Club" }),
    ];

    const warnings = computeConcentrationWarnings(starters);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("3 starters from FC Bayern München");
  });

  it("raises no warning when no club has more than 2 starters", () => {
    const starters = [
      player({ id: "1", teamName: "Team A" }),
      player({ id: "2", teamName: "Team A" }),
      player({ id: "3", teamName: "Team B" }),
    ];

    expect(computeConcentrationWarnings(starters)).toEqual([]);
  });

  it("flags multiple clubs independently", () => {
    const starters = [
      player({ id: "1", teamName: "Team A" }),
      player({ id: "2", teamName: "Team A" }),
      player({ id: "3", teamName: "Team A" }),
      player({ id: "4", teamName: "Team B" }),
      player({ id: "5", teamName: "Team B" }),
      player({ id: "6", teamName: "Team B" }),
      player({ id: "7", teamName: "Team B" }),
    ];

    const warnings = computeConcentrationWarnings(starters);

    expect(warnings).toHaveLength(2);
    expect(warnings.some((w) => w.includes("3 starters from Team A"))).toBe(true);
    expect(warnings.some((w) => w.includes("4 starters from Team B"))).toBe(true);
  });

  it("returns an empty list for an empty starter list", () => {
    expect(computeConcentrationWarnings([])).toEqual([]);
  });
});
