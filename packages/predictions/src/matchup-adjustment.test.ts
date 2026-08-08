import { describe, expect, it } from "vitest";
import { computeMatchupAdjustment } from "./matchup-adjustment.js";
import type { SplitRecord, TeamHomeAwaySplit, TeamStrengthInput } from "./types.js";

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

function splitRecord(overrides: Partial<SplitRecord> = {}): SplitRecord {
  return {
    matchesConsidered: 5,
    wins: 3,
    draws: 1,
    losses: 1,
    pointsPerGame: 2.0,
    goalsFor: 10,
    goalsAgainst: 5,
    goalDifference: 5,
    cleanSheets: 2,
    ...overrides,
  };
}

function homeAwaySplit(overrides: Partial<TeamHomeAwaySplit> = {}): TeamHomeAwaySplit {
  return {
    teamName: "FC Bayern München",
    home: splitRecord({ pointsPerGame: 2.5 }),
    away: splitRecord({ pointsPerGame: 1.0 }),
    homeAdvantageDelta: 1.5,
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

  it("uses the generic home-advantage assumption when no team-specific split is supplied", () => {
    const result = computeMatchupAdjustment({ position: "Sturm", isHome: true });
    expect(result.rationale[0]).toMatch(/generic assumption/i);
  });

  it("uses the generic assumption when the team-specific split doesn't have enough matches yet", () => {
    const thinSplit = homeAwaySplit({
      home: splitRecord({ matchesConsidered: 1 }),
      away: splitRecord({ matchesConsidered: 1 }),
    });
    const result = computeMatchupAdjustment({ position: "Sturm", isHome: true, ownTeamHomeAwaySplit: thinSplit });
    expect(result.rationale[0]).toMatch(/generic assumption/i);
  });

  it("uses the team's own measured split once both sides have enough matches", () => {
    const strongAtHome = homeAwaySplit({
      home: splitRecord({ matchesConsidered: 5, pointsPerGame: 2.7 }),
      away: splitRecord({ matchesConsidered: 5, pointsPerGame: 0.8 }),
      homeAdvantageDelta: 1.9,
    });

    const atHome = computeMatchupAdjustment({ position: "Sturm", isHome: true, ownTeamHomeAwaySplit: strongAtHome });
    const away = computeMatchupAdjustment({ position: "Sturm", isHome: false, ownTeamHomeAwaySplit: strongAtHome });

    expect(atHome.rationale[0]).toMatch(/measured split this season/i);
    expect(atHome.adjustmentPct).toBeGreaterThan(0);
    expect(away.adjustmentPct).toBeLessThan(0);
    // A team with a much bigger real split should get a bigger swing than the flat 3% generic assumption.
    expect(atHome.adjustmentPct).toBeGreaterThan(0.03);
  });

  it("gives a team that's actually stronger away a negative home adjustment", () => {
    const strongAway = homeAwaySplit({
      home: splitRecord({ matchesConsidered: 5, pointsPerGame: 0.8 }),
      away: splitRecord({ matchesConsidered: 5, pointsPerGame: 2.2 }),
      homeAdvantageDelta: -1.4,
    });

    const atHome = computeMatchupAdjustment({ position: "Sturm", isHome: true, ownTeamHomeAwaySplit: strongAway });

    expect(atHome.adjustmentPct).toBeLessThan(0);
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
