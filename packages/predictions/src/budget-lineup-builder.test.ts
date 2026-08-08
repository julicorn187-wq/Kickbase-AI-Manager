import { describe, expect, it } from "vitest";
import { buildBudgetConstrainedLineup } from "./budget-lineup-builder.js";
import type { KickbasePosition, PlayerValueScore } from "./types.js";

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

function pool(counts: Record<KickbasePosition, number>, marketValue = 1_000_000): PlayerValueScore[] {
  const players: PlayerValueScore[] = [];
  let globalIndex = 0;
  (Object.keys(counts) as KickbasePosition[]).forEach((position) => {
    for (let i = 0; i < counts[position]; i++) {
      players.push(
        player({
          id: `${position}-${String(i)}`,
          position,
          name: `${position} #${String(i)}`,
          compositeScore: 100 - i,
          marketValue,
          teamName: `Team ${String(globalIndex++)}`,
        }),
      );
    }
  });
  return players;
}

describe("buildBudgetConstrainedLineup", () => {
  it("fills every slot when the budget comfortably covers the whole formation", () => {
    const players = pool({ Torwart: 2, Abwehr: 5, Mittelfeld: 5, Sturm: 3 }, 1_000_000);

    const lineup = buildBudgetConstrainedLineup(players, 150_000_000);

    expect(lineup.starters).toHaveLength(11);
    expect(lineup.unfilledSlots).toEqual([]);
    expect(lineup.totalCost).toBe(11_000_000);
    expect(lineup.remainingBudget).toBe(150_000_000 - 11_000_000);
  });

  it("never spends more than the given budget", () => {
    const players = pool({ Torwart: 2, Abwehr: 5, Mittelfeld: 5, Sturm: 3 }, 20_000_000);

    const lineup = buildBudgetConstrainedLineup(players, 50_000_000);

    const actualSpend = lineup.starters.reduce((sum, p) => sum + p.marketValue, 0);
    expect(actualSpend).toBeLessThanOrEqual(50_000_000);
    expect(lineup.totalCost).toBe(actualSpend);
  });

  it("reports unfilled slots rather than exceeding budget or inventing a player", () => {
    const players = pool({ Torwart: 1, Abwehr: 4, Mittelfeld: 4, Sturm: 2 }, 100_000_000);

    const lineup = buildBudgetConstrainedLineup(players, 50_000_000);

    expect(lineup.starters.length).toBeLessThan(11);
    expect(lineup.unfilledSlots.length).toBe(11 - lineup.starters.length);
  });

  it("downgrades to the cheaper pick only when the budget can't cover the best-score choice", () => {
    const players = [
      player({ id: "cheap-good", position: "Sturm", compositeScore: 100, marketValue: 1_000_000 }),
      player({ id: "expensive-good", position: "Sturm", compositeScore: 110, marketValue: 50_000_000 }),
      player({ id: "gk", position: "Torwart", compositeScore: 50, marketValue: 1_000_000 }),
    ];

    // Budget only covers one Sturm slot's worth of spend if the expensive one is picked, so the cheap
    // high-density pick should win even though its raw compositeScore is slightly lower.
    const lineup = buildBudgetConstrainedLineup(players, 2_000_000, { Torwart: 1, Abwehr: 0, Mittelfeld: 0, Sturm: 1 });

    expect(lineup.starters.map((p) => p.id)).toContain("cheap-good");
    expect(lineup.starters.map((p) => p.id)).not.toContain("expensive-good");
  });

  it("regression: picks the higher-scoring expensive player when the budget can afford it, not the cheapest one", () => {
    // This is the exact failure mode a real backtest exposed: a pure points-per-Euro (value-density)
    // greedy would always prefer "cheap-good" here (100 pts / 1M vs. 110 pts / 50M is a MUCH better
    // ratio), leaving most of an abundant budget unspent on bench-caliber players. The correct behavior
    // is to spend the budget on the higher score when it's actually affordable.
    const players = [
      player({ id: "cheap-good", position: "Sturm", compositeScore: 100, marketValue: 1_000_000 }),
      player({ id: "expensive-better", position: "Sturm", compositeScore: 110, marketValue: 50_000_000 }),
    ];

    const lineup = buildBudgetConstrainedLineup(players, 150_000_000, {
      Torwart: 0,
      Abwehr: 0,
      Mittelfeld: 0,
      Sturm: 1,
    });

    expect(lineup.starters.map((p) => p.id)).toEqual(["expensive-better"]);
  });

  it("respects a custom formation's slot counts", () => {
    const players = pool({ Torwart: 2, Abwehr: 6, Mittelfeld: 6, Sturm: 6 }, 1_000_000);

    const lineup = buildBudgetConstrainedLineup(players, 150_000_000, {
      Torwart: 1,
      Abwehr: 3,
      Mittelfeld: 5,
      Sturm: 2,
    });

    expect(lineup.starters.filter((p) => p.position === "Abwehr")).toHaveLength(3);
    expect(lineup.starters.filter((p) => p.position === "Mittelfeld")).toHaveLength(5);
  });

  it("never picks the same player twice", () => {
    const players = pool({ Torwart: 1, Abwehr: 4, Mittelfeld: 4, Sturm: 2 }, 1_000_000);

    const lineup = buildBudgetConstrainedLineup(players, 150_000_000);

    const uniqueIds = new Set(lineup.starters.map((p) => p.id));
    expect(uniqueIds.size).toBe(lineup.starters.length);
  });

  it("flags concentration risk when the best-affordable picks pile onto one club", () => {
    const players = [
      player({ id: "gk", position: "Torwart", teamName: "FC Bayern München", compositeScore: 10 }),
      player({ id: "def-1", position: "Abwehr", teamName: "FC Bayern München", compositeScore: 10 }),
      player({ id: "def-2", position: "Abwehr", teamName: "FC Bayern München", compositeScore: 10 }),
      player({ id: "def-3", position: "Abwehr", teamName: "FC Bayern München", compositeScore: 10 }),
    ];

    const lineup = buildBudgetConstrainedLineup(players, 150_000_000, {
      Torwart: 1,
      Abwehr: 3,
      Mittelfeld: 0,
      Sturm: 0,
    });

    expect(lineup.concentrationWarnings).toHaveLength(1);
    expect(lineup.concentrationWarnings[0]).toContain("4 starters from FC Bayern München");
  });
});
