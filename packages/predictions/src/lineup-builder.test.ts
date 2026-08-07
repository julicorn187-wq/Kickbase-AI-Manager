import { describe, expect, it } from "vitest";
import { buildValueLineup, DEFAULT_FORMATION } from "./lineup-builder.js";
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

function pool(counts: Record<KickbasePosition, number>): PlayerValueScore[] {
  const players: PlayerValueScore[] = [];
  let globalIndex = 0;
  (Object.keys(counts) as KickbasePosition[]).forEach((position) => {
    for (let i = 0; i < counts[position]; i++) {
      players.push(
        player({
          id: `${position}-${i}`,
          position,
          compositeScore: 100 - i,
          name: `${position} #${i}`,
          // Every player on a distinct team so pool-based tests never trip the concentration-risk check by accident.
          teamName: `Team ${String(globalIndex++)}`,
        }),
      );
    }
  });
  return players;
}

describe("buildValueLineup", () => {
  it("fills every formation slot with the top-scoring players per position", () => {
    const players = pool({ Torwart: 3, Abwehr: 6, Mittelfeld: 6, Sturm: 4 });
    const lineup = buildValueLineup(players);

    expect(lineup.starters).toHaveLength(11);
    expect(lineup.starters.filter((p) => p.position === "Torwart")).toHaveLength(1);
    expect(lineup.starters.filter((p) => p.position === "Abwehr")).toHaveLength(4);
    expect(lineup.starters.filter((p) => p.position === "Mittelfeld")).toHaveLength(4);
    expect(lineup.starters.filter((p) => p.position === "Sturm")).toHaveLength(2);
  });

  it("picks the highest compositeScore first within each position", () => {
    const players = pool({ Torwart: 1, Abwehr: 1, Mittelfeld: 1, Sturm: 3 });
    const lineup = buildValueLineup(players);

    const strikers = lineup.starters.filter((p) => p.position === "Sturm");
    expect(strikers.map((p) => p.id)).toEqual(["Sturm-0", "Sturm-1"]);
  });

  it("puts leftover players on the bench, capped at 3 per position", () => {
    const players = pool({ Torwart: 1, Abwehr: 1, Mittelfeld: 1, Sturm: 10 });
    const lineup = buildValueLineup(players);

    const benchStrikers = lineup.bench.filter((p) => p.position === "Sturm");
    expect(benchStrikers).toHaveLength(3);
    expect(benchStrikers.map((p) => p.id)).toEqual(["Sturm-2", "Sturm-3", "Sturm-4"]);
  });

  it("leaves a slot unfilled when the pool has fewer players than the formation needs", () => {
    const players = pool({ Torwart: 1, Abwehr: 1, Mittelfeld: 1, Sturm: 0 });
    const lineup = buildValueLineup(players);

    expect(lineup.starters.filter((p) => p.position === "Sturm")).toHaveLength(0);
    expect(lineup.starters.length).toBeLessThan(11);
  });

  it("respects a custom formation", () => {
    const players = pool({ Torwart: 2, Abwehr: 6, Mittelfeld: 6, Sturm: 6 });
    const lineup = buildValueLineup(players, { Torwart: 1, Abwehr: 3, Mittelfeld: 5, Sturm: 2 });

    expect(lineup.formation).toEqual({ Torwart: 1, Abwehr: 3, Mittelfeld: 5, Sturm: 2 });
    expect(lineup.starters.filter((p) => p.position === "Abwehr")).toHaveLength(3);
    expect(lineup.starters.filter((p) => p.position === "Mittelfeld")).toHaveLength(5);
  });

  it("defaults to a balanced 1-4-4-2 formation", () => {
    expect(DEFAULT_FORMATION).toEqual({ Torwart: 1, Abwehr: 4, Mittelfeld: 4, Sturm: 2 });
  });

  it("flags a club with more than 2 starters as concentrated risk", () => {
    const players = [
      player({ id: "gk", position: "Torwart", teamName: "FC Bayern München" }),
      player({ id: "def-1", position: "Abwehr", teamName: "FC Bayern München" }),
      player({ id: "def-2", position: "Abwehr", teamName: "FC Bayern München" }),
      player({ id: "def-3", position: "Abwehr", teamName: "Team A" }),
      player({ id: "def-4", position: "Abwehr", teamName: "Team A" }),
      player({ id: "mid-0", position: "Mittelfeld", teamName: "Team B" }),
      player({ id: "mid-1", position: "Mittelfeld", teamName: "Team B" }),
      player({ id: "mid-2", position: "Mittelfeld", teamName: "Team C" }),
      player({ id: "mid-3", position: "Mittelfeld", teamName: "Team C" }),
      player({ id: "fwd-0", position: "Sturm", teamName: "Team D" }),
      player({ id: "fwd-1", position: "Sturm", teamName: "Team D" }),
    ];

    const lineup = buildValueLineup(players);

    expect(lineup.concentrationWarnings).toHaveLength(1);
    expect(lineup.concentrationWarnings[0]).toContain("3 starters from FC Bayern München");
  });

  it("raises no warning when no club has more than 2 starters", () => {
    const players = pool({ Torwart: 1, Abwehr: 4, Mittelfeld: 4, Sturm: 2 });
    const lineup = buildValueLineup(players);

    expect(lineup.concentrationWarnings).toEqual([]);
  });
});
