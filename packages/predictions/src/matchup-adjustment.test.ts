import { describe, expect, it } from "vitest";
import { computeMatchupAdjustment } from "./matchup-adjustment.js";
import type { TeamStrengthInput } from "./types.js";

function team(overrides: Partial<TeamStrengthInput> = {}): TeamStrengthInput {
  return {
    teamName: "FC Bayern München",
    matchesConsidered: 5,
    wins: 3,
    draws: 1,
    losses: 1,
    goalsFor: 10,
    goalsAgainst: 5,
    cleanSheets: 2,
    ...overrides,
  };
}

describe("computeMatchupAdjustment", () => {
  it("returns a neutral 0% adjustment with an explanatory note when no data is available", () => {
    const result = computeMatchupAdjustment({ position: "Sturm" });
    expect(result.adjustmentPct).toBe(0);
    expect(result.rationale[0]).toMatch(/no matchup data available/i);
  });

  it("applies a positive home adjustment and a negative away adjustment", () => {
    const home = computeMatchupAdjustment({ position: "Sturm", isHome: true });
    const away = computeMatchupAdjustment({ position: "Sturm", isHome: false });
    expect(home.adjustmentPct).toBeGreaterThan(0);
    expect(away.adjustmentPct).toBeLessThan(0);
    expect(home.adjustmentPct).toBeCloseTo(-away.adjustmentPct, 5);
  });

  it("rewards an above-baseline implied win probability", () => {
    const favored = computeMatchupAdjustment({
      position: "Sturm",
      impliedProbabilities: { win: 0.7, draw: 0.2, loss: 0.1 },
    });
    const underdog = computeMatchupAdjustment({
      position: "Sturm",
      impliedProbabilities: { win: 0.1, draw: 0.2, loss: 0.7 },
    });
    expect(favored.adjustmentPct).toBeGreaterThan(0);
    expect(underdog.adjustmentPct).toBeLessThan(0);
  });

  it("rewards defenders/goalkeepers for their own team's clean-sheet rate, not attacking output", () => {
    const strongDefense = team({ cleanSheets: 4, matchesConsidered: 5, goalsFor: 2 });
    const gkResult = computeMatchupAdjustment({ position: "Torwart", ownTeam: strongDefense });
    const defResult = computeMatchupAdjustment({ position: "Abwehr", ownTeam: strongDefense });
    expect(gkResult.adjustmentPct).toBeGreaterThan(0);
    expect(defResult.adjustmentPct).toBeGreaterThan(0);
  });

  it("rewards midfielders/forwards for their own team's scoring rate, not clean sheets", () => {
    const strongAttack = team({ goalsFor: 15, matchesConsidered: 5, cleanSheets: 0 });
    const result = computeMatchupAdjustment({ position: "Sturm", ownTeam: strongAttack });
    expect(result.adjustmentPct).toBeGreaterThan(0);
  });

  it("rewards attackers for facing a leaky opponent defense", () => {
    const leakyOpponent = team({ goalsAgainst: 15, matchesConsidered: 5 });
    const result = computeMatchupAdjustment({ position: "Sturm", opponentTeam: leakyOpponent });
    expect(result.adjustmentPct).toBeGreaterThan(0);
  });

  it("rewards defenders for facing a toothless opponent attack", () => {
    const toothlessOpponent = team({ goalsFor: 0, matchesConsidered: 5 });
    const result = computeMatchupAdjustment({ position: "Abwehr", opponentTeam: toothlessOpponent });
    expect(result.adjustmentPct).toBeGreaterThan(0);
  });

  it("ignores team data when matchesConsidered is 0 (pre-season) rather than dividing by zero", () => {
    const noData = team({ matchesConsidered: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0 });
    const result = computeMatchupAdjustment({ position: "Sturm", ownTeam: noData, opponentTeam: noData });
    expect(result.adjustmentPct).toBe(0);
    expect(Number.isFinite(result.adjustmentPct)).toBe(true);
  });

  it("caps the combined adjustment and notes the cap was applied", () => {
    const extreme = team({ goalsFor: 100, matchesConsidered: 5, cleanSheets: 5, goalsAgainst: 0 });
    const result = computeMatchupAdjustment({
      position: "Sturm",
      isHome: true,
      impliedProbabilities: { win: 0.95, draw: 0.03, loss: 0.02 },
      ownTeam: extreme,
      opponentTeam: extreme,
    });
    expect(result.adjustmentPct).toBeLessThanOrEqual(0.25);
    expect(result.rationale.some((r) => r.includes("capped"))).toBe(true);
  });
});
