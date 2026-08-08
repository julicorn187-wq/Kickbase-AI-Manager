import { describe, expect, it } from "vitest";
import { computeHomeAwaySplit } from "./home-away-split.js";
import type { TeamMatchInput } from "./types.js";

function match(overrides: Partial<TeamMatchInput> = {}): TeamMatchInput {
  return {
    opponentName: "Opponent",
    kickoffUtc: "2026-08-01T00:00:00Z",
    isHome: true,
    competition: "Bundesliga",
    isFinished: true,
    result: "W",
    goalsFor: 2,
    goalsAgainst: 0,
    ...overrides,
  };
}

describe("computeHomeAwaySplit", () => {
  it("returns all-zero records when there are no finished matches", () => {
    const result = computeHomeAwaySplit([match({ isFinished: false, result: undefined })]);
    expect(result.home).toEqual({
      matchesConsidered: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      pointsPerGame: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      cleanSheets: 0,
    });
    expect(result.homeAdvantageDelta).toBe(0);
  });

  it("splits matches by isHome and computes points-per-game separately", () => {
    const result = computeHomeAwaySplit([
      match({ isHome: true, result: "W" }),
      match({ isHome: true, result: "W" }),
      match({ isHome: true, result: "D" }),
      match({ isHome: false, result: "L" }),
      match({ isHome: false, result: "L" }),
      match({ isHome: false, result: "D" }),
    ]);

    expect(result.home.matchesConsidered).toBe(3);
    expect(result.home.pointsPerGame).toBeCloseTo((3 + 3 + 1) / 3, 5);
    expect(result.away.matchesConsidered).toBe(3);
    expect(result.away.pointsPerGame).toBeCloseTo(1 / 3, 5);
  });

  it("reports a positive homeAdvantageDelta for a team that performs better at home", () => {
    const result = computeHomeAwaySplit([
      match({ isHome: true, result: "W" }),
      match({ isHome: true, result: "W" }),
      match({ isHome: false, result: "L" }),
      match({ isHome: false, result: "L" }),
    ]);

    expect(result.homeAdvantageDelta).toBeGreaterThan(0);
  });

  it("reports a negative homeAdvantageDelta for a team that performs better away", () => {
    const result = computeHomeAwaySplit([
      match({ isHome: true, result: "L" }),
      match({ isHome: true, result: "L" }),
      match({ isHome: false, result: "W" }),
      match({ isHome: false, result: "W" }),
    ]);

    expect(result.homeAdvantageDelta).toBeLessThan(0);
  });

  it("ignores matches without a recorded result rather than guessing", () => {
    const result = computeHomeAwaySplit([
      match({ isHome: true, result: "W" }),
      match({ isHome: true, isFinished: false, result: undefined }),
    ]);

    expect(result.home.matchesConsidered).toBe(1);
  });

  it("computes goal difference and clean sheets per side independently", () => {
    const result = computeHomeAwaySplit([
      match({ isHome: true, result: "W", goalsFor: 3, goalsAgainst: 0 }),
      match({ isHome: false, result: "L", goalsFor: 0, goalsAgainst: 2 }),
    ]);

    expect(result.home).toMatchObject({ goalsFor: 3, goalsAgainst: 0, goalDifference: 3, cleanSheets: 1 });
    expect(result.away).toMatchObject({ goalsFor: 0, goalsAgainst: 2, goalDifference: -2, cleanSheets: 0 });
  });
});
