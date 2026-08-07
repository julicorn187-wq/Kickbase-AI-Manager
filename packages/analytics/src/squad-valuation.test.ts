import { describe, expect, it } from "vitest";
import { evaluateSquad, type SquadValuationPlayerInput } from "./squad-valuation.js";

function player(overrides: Partial<SquadValuationPlayerInput> = {}): SquadValuationPlayerInput {
  return {
    id: "1",
    name: "Player",
    marketValue: 1_000_000,
    marketValueGainLoss: 0,
    points: 50,
    averagePoints: 5,
    position: 4,
    status: 0,
    matchdayStatus: 0,
    ...overrides,
  };
}

describe("evaluateSquad", () => {
  it("returns zeroed totals for an empty squad", () => {
    const result = evaluateSquad([]);
    expect(result.playerCount).toBe(0);
    expect(result.totalMarketValue).toBe(0);
    expect(result.averagePointsPerPlayer).toBe(0);
    expect(result.positionBreakdown).toEqual([]);
    expect(result.playersNeedingAttention).toEqual([]);
  });

  it("sums market value, gain/loss, and points across the squad", () => {
    const result = evaluateSquad([
      player({ id: "1", marketValue: 1_000_000, marketValueGainLoss: 50_000, points: 40 }),
      player({ id: "2", marketValue: 2_000_000, marketValueGainLoss: -20_000, points: 60 }),
    ]);

    expect(result.totalMarketValue).toBe(3_000_000);
    expect(result.totalMarketValueGainLoss).toBe(30_000);
    expect(result.totalPoints).toBe(100);
    expect(result.averagePointsPerPlayer).toBe(50);
  });

  it("groups the position breakdown by position, sorted ascending", () => {
    const result = evaluateSquad([
      player({ id: "1", position: 4, marketValue: 1_000_000 }),
      player({ id: "2", position: 1, marketValue: 500_000 }),
      player({ id: "3", position: 4, marketValue: 3_000_000 }),
    ]);

    expect(result.positionBreakdown).toEqual([
      { position: 1, playerCount: 1, totalMarketValue: 500_000 },
      { position: 4, playerCount: 2, totalMarketValue: 4_000_000 },
    ]);
  });

  it("flags players with a non-zero status or matchdayStatus", () => {
    const result = evaluateSquad([
      player({ id: "1", status: 0, matchdayStatus: 0 }),
      player({ id: "2", name: "Hurt Guy", status: 1, matchdayStatus: 0 }),
      player({ id: "3", name: "Bench Guy", status: 0, matchdayStatus: 2 }),
    ]);

    expect(result.playersNeedingAttention).toEqual([
      { id: "2", name: "Hurt Guy", status: 1, matchdayStatus: 0 },
      { id: "3", name: "Bench Guy", status: 0, matchdayStatus: 2 },
    ]);
  });

  it("lists declining players worst-first, excluding players with flat or rising value", () => {
    const result = evaluateSquad([
      player({ id: "1", name: "Rising", marketValueGainLoss: 10_000 }),
      player({ id: "2", name: "Flat", marketValueGainLoss: 0 }),
      player({ id: "3", name: "Slightly Down", marketValueGainLoss: -5_000 }),
      player({ id: "4", name: "Way Down", marketValueGainLoss: -50_000 }),
    ]);

    expect(result.decliningPlayers).toEqual([
      { id: "4", name: "Way Down", marketValueGainLoss: -50_000 },
      { id: "3", name: "Slightly Down", marketValueGainLoss: -5_000 },
    ]);
  });

  it("caps the declining players list at 5", () => {
    const players = Array.from({ length: 8 }, (_, index) =>
      player({ id: String(index), marketValueGainLoss: -(index + 1) * 1000 }),
    );

    const result = evaluateSquad(players);

    expect(result.decliningPlayers).toHaveLength(5);
    expect(result.decliningPlayers[0]?.marketValueGainLoss).toBe(-8000);
  });
});
