import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildForecastSnapshot,
  evaluateSnapshot,
  formatEvaluationReport,
  loadPendingSnapshots,
  resolveMatchdayNumber,
  reviewForecastAccuracy,
  saveForecastSnapshot,
  type ForecastSnapshot,
} from "./forecast-log.js";
import type { BaseXiPlayer } from "@kickbase-ai-manager/basexi";
import type { PlayerValueScore, ValueLineup } from "@kickbase-ai-manager/predictions";

function nextMatch(matchday: number): NonNullable<BaseXiPlayer["next_match"]> {
  return { date: "01.09.", date_iso: "2026-09-01T13:30:00", matchday, home_game: true, difficulty: 2, odds: "- | - | -" };
}

function baseXiPlayer(overrides: Partial<BaseXiPlayer> = {}): BaseXiPlayer {
  return {
    id: "1",
    name: "Harry Kane",
    position: "Sturm",
    teamName: "FC Bayern München",
    teamAbbr: "FCB",
    marketValue: 68_000_000,
    mvTrend: 34_000,
    avgPoints: 150,
    avgPrevSeason: 216,
    totalPoints: 300,
    totalPrevSeason: 6703,
    matchesPlayed: 2,
    gamesPrevSeason: 31,
    status: 0,
    statusText: null,
    isHot: false,
    momentum: "dark_green",
    match_data: { home_game: true, next_opponent: "VfB Stuttgart", odds: "- | - | -" },
    next_match: nextMatch(3),
    ...overrides,
  };
}

function scoredPlayer(overrides: Partial<PlayerValueScore> = {}): PlayerValueScore {
  return {
    id: "1",
    name: "Harry Kane",
    position: "Sturm",
    teamName: "FC Bayern München",
    marketValue: 68_000_000,
    averagePoints: 150,
    averagePointsSource: "current-season",
    gamesConsidered: 2,
    adjustmentPct: 0,
    compositeScore: 150,
    rationale: [],
    ...overrides,
  };
}

function lineup(starters: PlayerValueScore[]): ValueLineup {
  return {
    formation: { Torwart: 1, Abwehr: 4, Mittelfeld: 4, Sturm: 2 },
    starters,
    bench: [],
    concentrationWarnings: [],
  };
}

describe("resolveMatchdayNumber", () => {
  it("returns undefined when no player has a next_match", () => {
    expect(resolveMatchdayNumber([baseXiPlayer({ next_match: null })])).toBeUndefined();
  });

  it("returns the most common matchday across players", () => {
    const players = [
      baseXiPlayer({ id: "1", next_match: nextMatch(3) }),
      baseXiPlayer({ id: "2", next_match: nextMatch(3) }),
      baseXiPlayer({ id: "3", next_match: nextMatch(4) }),
    ];
    expect(resolveMatchdayNumber(players)).toBe(3);
  });
});

describe("buildForecastSnapshot", () => {
  it("only includes scored players that have matching raw data", () => {
    const starter = scoredPlayer({ id: "1" });
    const scored = [starter, scoredPlayer({ id: "2", name: "Other" })];
    const rawById = new Map([["1", { totalPoints: 100, matchesPlayed: 1 }]]);

    const snapshot = buildForecastSnapshot(3, scored, lineup([starter]), rawById);

    expect(snapshot.players).toHaveLength(1);
    expect(snapshot.players[0]).toMatchObject({ id: "1", wasStarter: true, totalPointsBefore: 100, matchesPlayedBefore: 1 });
  });
});

describe("forecast log file persistence", () => {
  let logDir: string;

  beforeEach(async () => {
    logDir = await mkdtemp(path.join(tmpdir(), "kickbase-forecast-log-"));
  });

  afterEach(async () => {
    await rm(logDir, { recursive: true, force: true });
  });

  it("saves and loads a pending snapshot", async () => {
    const snapshot: ForecastSnapshot = {
      matchday: 5,
      createdAtIso: "2026-08-08T00:00:00Z",
      players: [
        { id: "1", name: "Kane", position: "Sturm", teamName: "FCB", compositeScore: 150, wasStarter: true, totalPointsBefore: 100, matchesPlayedBefore: 1 },
      ],
    };

    await saveForecastSnapshot(logDir, snapshot);
    const pending = await loadPendingSnapshots(logDir);

    expect(pending).toHaveLength(1);
    expect(pending[0]?.matchday).toBe(5);
  });

  it("never overwrites an existing snapshot for the same matchday", async () => {
    const first: ForecastSnapshot = { matchday: 5, createdAtIso: "2026-08-08T00:00:00Z", players: [] };
    const second: ForecastSnapshot = { matchday: 5, createdAtIso: "2026-09-01T00:00:00Z", players: [] };

    await saveForecastSnapshot(logDir, first);
    await saveForecastSnapshot(logDir, second);
    const pending = await loadPendingSnapshots(logDir);

    expect(pending).toHaveLength(1);
    expect(pending[0]?.createdAtIso).toBe("2026-08-08T00:00:00Z");
  });

  it("returns an empty list when the log directory doesn't exist yet", async () => {
    const pending = await loadPendingSnapshots(path.join(logDir, "nonexistent"));
    expect(pending).toEqual([]);
  });

  it("reviewForecastAccuracy reports nothing logged yet when the directory is empty", async () => {
    const report = await reviewForecastAccuracy(logDir, []);
    expect(report).toMatch(/no forecasts logged yet/i);
  });

  it("reviewForecastAccuracy skips a snapshot whose matchday hasn't been played and marks nothing evaluated", async () => {
    const snapshot: ForecastSnapshot = {
      matchday: 5,
      createdAtIso: "2026-08-08T00:00:00Z",
      players: [
        { id: "1", name: "Kane", position: "Sturm", teamName: "FCB", compositeScore: 150, wasStarter: true, totalPointsBefore: 100, matchesPlayedBefore: 1 },
      ],
    };
    await saveForecastSnapshot(logDir, snapshot);

    const report = await reviewForecastAccuracy(logDir, [baseXiPlayer({ id: "1", totalPoints: 100, matchesPlayed: 1 })]);

    expect(report).toMatch(/none of their matchdays have been played yet/i);
    expect(await loadPendingSnapshots(logDir)).toHaveLength(1); // still pending, not marked evaluated
  });

  it("evaluates a snapshot once matchesPlayed increased by exactly 1 and marks it evaluated", async () => {
    const snapshot: ForecastSnapshot = {
      matchday: 5,
      createdAtIso: "2026-08-08T00:00:00Z",
      players: [
        { id: "1", name: "Kane", position: "Sturm", teamName: "FCB", compositeScore: 150, wasStarter: true, totalPointsBefore: 100, matchesPlayedBefore: 1 },
        { id: "2", name: "Bench Guy", position: "Sturm", teamName: "FCB", compositeScore: 50, wasStarter: false, totalPointsBefore: 20, matchesPlayedBefore: 1 },
      ],
    };
    await saveForecastSnapshot(logDir, snapshot);

    const report = await reviewForecastAccuracy(logDir, [
      baseXiPlayer({ id: "1", totalPoints: 140, matchesPlayed: 2 }), // scored 40
      baseXiPlayer({ id: "2", totalPoints: 100, matchesPlayed: 2 }), // scored 80, beat the starter
    ]);

    expect(report).toContain("matchday 5");
    expect(report).toContain("Bench Guy");
    expect(report).toContain("80 pts");
    expect(await loadPendingSnapshots(logDir)).toHaveLength(0); // now evaluated, no longer pending
  });
});

describe("evaluateSnapshot", () => {
  it("returns undefined when nothing in the snapshot is ready to evaluate", () => {
    const snapshot: ForecastSnapshot = {
      matchday: 5,
      createdAtIso: "2026-08-08T00:00:00Z",
      players: [
        { id: "1", name: "Kane", position: "Sturm", teamName: "FCB", compositeScore: 150, wasStarter: true, totalPointsBefore: 100, matchesPlayedBefore: 1 },
      ],
    };

    expect(evaluateSnapshot(snapshot, [baseXiPlayer({ id: "1", matchesPlayed: 1, totalPoints: 100 })])).toBeUndefined();
  });

  it("skips a player whose matchesPlayed jumped by more than 1", () => {
    const snapshot: ForecastSnapshot = {
      matchday: 5,
      createdAtIso: "2026-08-08T00:00:00Z",
      players: [
        { id: "1", name: "Kane", position: "Sturm", teamName: "FCB", compositeScore: 150, wasStarter: true, totalPointsBefore: 100, matchesPlayedBefore: 1 },
        { id: "2", name: "Other", position: "Sturm", teamName: "FCB", compositeScore: 100, wasStarter: false, totalPointsBefore: 50, matchesPlayedBefore: 1 },
      ],
    };

    const result = evaluateSnapshot(snapshot, [
      baseXiPlayer({ id: "1", matchesPlayed: 3, totalPoints: 250 }),
      baseXiPlayer({ id: "2", matchesPlayed: 2, totalPoints: 90 }),
    ]);

    expect(result?.playerResults).toHaveLength(1);
    expect(result?.playerResults[0]?.id).toBe("2");
    expect(result?.skippedPlayers.some((p) => p.id === "1" && p.reason.includes("2 matchdays"))).toBe(true);
  });
});

describe("formatEvaluationReport", () => {
  it("includes the matchday number and per-player actual points", () => {
    const snapshot: ForecastSnapshot = {
      matchday: 7,
      createdAtIso: "2026-09-01T00:00:00Z",
      players: [],
    };
    const evaluation = evaluateSnapshot(
      { ...snapshot, players: [{ id: "1", name: "Kane", position: "Sturm", teamName: "FCB", compositeScore: 150, wasStarter: true, totalPointsBefore: 0, matchesPlayedBefore: 0 }] },
      [baseXiPlayer({ id: "1", matchesPlayed: 1, totalPoints: 65 })],
    );

    if (!evaluation) throw new Error("expected an evaluation result");
    const report = formatEvaluationReport(snapshot, evaluation);
    expect(report).toContain("matchday 7");
    expect(report).toContain("Kane");
    expect(report).toContain("65 pts");
  });
});
