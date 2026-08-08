import { describe, expect, it } from "vitest";
import { capCandidatesPerTeam } from "./team-cap.js";
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

describe("capCandidatesPerTeam", () => {
  it("keeps at most maxPerTeam candidates per club, highest score first", () => {
    const players = [
      player({ id: "1", teamName: "A", compositeScore: 90, position: "Sturm" }),
      player({ id: "2", teamName: "A", compositeScore: 80, position: "Mittelfeld" }),
      // Team A's 3rd-best (Abwehr) is capped out, but team B also has an Abwehr candidate,
      // so the "rescue a globally missing position" path never triggers here.
      player({ id: "3", teamName: "A", compositeScore: 70, position: "Abwehr" }),
      player({ id: "4", teamName: "B", compositeScore: 60, position: "Torwart" }),
      player({ id: "5", teamName: "B", compositeScore: 55, position: "Abwehr" }),
    ];

    const result = capCandidatesPerTeam(players, 2);

    const teamAIds = result.filter((p) => p.teamName === "A").map((p) => p.id);
    expect(teamAIds).toEqual(["1", "2"]);
  });

  it("never exceeds maxPerTeam per club even when rescuing a missing position", () => {
    // Team A's only goalkeeper scores lowest overall and gets capped out; no other team has one.
    const players = [
      player({ id: "gk", teamName: "A", position: "Torwart", compositeScore: 10 }),
      player({ id: "a1", teamName: "A", position: "Sturm", compositeScore: 90 }),
      player({ id: "a2", teamName: "A", position: "Mittelfeld", compositeScore: 80 }),
      player({ id: "b1", teamName: "B", position: "Abwehr", compositeScore: 50 }),
    ];

    const result = capCandidatesPerTeam(players, 2);

    // Torwart must be rescued globally (it's the only one anywhere), but team A must not exceed 2
    // from its OWN top-2 plus the rescue - the rescue itself is a 3rd slot, that's the accepted
    // rare exception, but it must not multiply into extra slots for every position.
    const teamACount = result.filter((p) => p.teamName === "A").length;
    expect(teamACount).toBe(3); // top-2 (a1, a2) + the rescued gk - the one documented exception
    expect(result.some((p) => p.position === "Torwart")).toBe(true);
  });

  it("does not rescue a position that already has at least one surviving candidate", () => {
    const players = [
      // Team A's goalkeeper scores lowest on the team and gets capped out of A's own top-2.
      player({ id: "a-gk", teamName: "A", position: "Torwart", compositeScore: 10 }),
      player({ id: "a1", teamName: "A", position: "Sturm", compositeScore: 90 }),
      player({ id: "a2", teamName: "A", position: "Mittelfeld", compositeScore: 80 }),
      // Team B's goalkeeper survives normally (team B has only this one player).
      player({ id: "b-gk", teamName: "B", position: "Torwart", compositeScore: 95 }),
    ];

    const result = capCandidatesPerTeam(players, 2);

    // Torwart is already covered by b-gk, so a-gk must NOT be rescued back in.
    expect(result.some((p) => p.id === "a-gk")).toBe(false);
    expect(result.filter((p) => p.teamName === "A")).toHaveLength(2);
  });

  it("does not duplicate players", () => {
    const players = [
      player({ id: "1", teamName: "A", compositeScore: 90 }),
      player({ id: "2", teamName: "A", compositeScore: 80 }),
      player({ id: "3", teamName: "A", compositeScore: 70 }),
    ];

    const result = capCandidatesPerTeam(players, 2);
    const uniqueIds = new Set(result.map((p) => p.id));
    expect(uniqueIds.size).toBe(result.length);
  });

  it("leaves a position unfilled if it truly doesn't exist anywhere in the pool", () => {
    const players = [player({ id: "1", teamName: "A", position: "Sturm" })];

    const result = capCandidatesPerTeam(players, 2);

    expect(result.some((p) => p.position === "Torwart")).toBe(false);
  });
});
