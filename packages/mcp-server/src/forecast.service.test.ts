import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForecastService } from "./forecast.service.js";
import { loadPendingSnapshots } from "./forecast-log.js";
import type { BaseXiClient, BaseXiPlayer } from "@kickbase-ai-manager/basexi";
import type { OpenLigaDbClient, OpenLigaMatch } from "@kickbase-ai-manager/openligadb";

function team(teamId: number, teamName: string, shortName: string) {
  return { teamId, teamName, shortName };
}

function bundesligaMatch(overrides: Partial<OpenLigaMatch> = {}): OpenLigaMatch {
  return {
    matchID: Math.floor(Math.random() * 100_000),
    matchDateTime: "2026-08-10T15:30:00",
    matchDateTimeUTC: "2026-08-10T13:30:00Z",
    leagueShortcut: "bl1",
    leagueSeason: 2026,
    group: { groupName: "1. Spieltag", groupOrderID: 1 },
    team1: team(40, "FC Bayern München", "Bayern"),
    team2: team(6, "Bayer 04 Leverkusen", "Leverkusen"),
    matchIsFinished: false,
    matchResults: [],
    ...overrides,
  };
}

function player(overrides: Partial<BaseXiPlayer> = {}): BaseXiPlayer {
  return {
    id: "1",
    name: "Harry Kane",
    position: "Sturm",
    teamName: "FC Bayern München",
    teamAbbr: "FCB",
    marketValue: 68_000_000,
    mvTrend: 34_000,
    avgPoints: 0,
    avgPrevSeason: 216,
    totalPoints: 0,
    totalPrevSeason: 6703,
    matchesPlayed: 0,
    gamesPrevSeason: 31,
    status: 0,
    statusText: null,
    isHot: false,
    momentum: "dark_green",
    match_data: { home_game: true, next_opponent: "Bayer 04 Leverkusen", odds: "- | - | -" },
    next_match: null,
    ...overrides,
  };
}

function mockBaseXiClient(players: BaseXiPlayer[]): BaseXiClient {
  return { getAllPlayers: vi.fn().mockResolvedValue(players), findPlayer: vi.fn() } as unknown as BaseXiClient;
}

function mockOpenLigaClient(matches: OpenLigaMatch[] = []): OpenLigaDbClient {
  return {
    getSeasonMatches: vi.fn().mockResolvedValue(matches),
    getAvailableLeagues: vi.fn().mockResolvedValue([]),
  } as unknown as OpenLigaDbClient;
}

describe("ForecastService", () => {
  it("filters out players with a non-Kickbase position", async () => {
    const service = new ForecastService(
      mockBaseXiClient([player(), player({ id: "2", name: "Coach-ish entry", position: "Trainer" })]),
      mockOpenLigaClient(),
    );

    const text = await service.getMatchdayValueLineup();

    expect(text).toContain("Harry Kane");
    expect(text).not.toContain("Coach-ish entry");
  });

  it("flags pre-season when every player falls back to previous-season averages", async () => {
    const service = new ForecastService(mockBaseXiClient([player()]), mockOpenLigaClient());

    const text = await service.getMatchdayValueLineup();

    expect(text).toMatch(/pre-season/i);
    expect(text).toContain("previous-season");
  });

  it("does not flag pre-season once a player has current-season matches", async () => {
    const service = new ForecastService(
      mockBaseXiClient([player({ matchesPlayed: 5, avgPoints: 120 })]),
      mockOpenLigaClient(),
    );

    const text = await service.getMatchdayValueLineup();

    expect(text).not.toMatch(/NOTE: no player has any recorded matches/i);
  });

  it("builds a suggested value-XI with the default formation", async () => {
    const players = [
      player({ id: "gk", name: "Goalkeeper", position: "Torwart" }),
      ...Array.from({ length: 5 }, (_, i) => player({ id: `def-${i}`, name: `Defender ${i}`, position: "Abwehr" })),
      ...Array.from({ length: 5 }, (_, i) =>
        player({ id: `mid-${i}`, name: `Midfielder ${i}`, position: "Mittelfeld" }),
      ),
      ...Array.from({ length: 3 }, (_, i) => player({ id: `fwd-${i}`, name: `Forward ${i}`, position: "Sturm" })),
    ];
    const service = new ForecastService(mockBaseXiClient(players), mockOpenLigaClient());

    const text = await service.getMatchdayValueLineup();

    expect(text).toContain("formation 1-4-4-2");
    expect(text).toContain("Goalkeeper");
  });

  it("applies a matchup adjustment once team-form data is available from OpenLigaDB", async () => {
    const finishedMatches = Array.from({ length: 5 }, (_, i) =>
      bundesligaMatch({
        matchDateTimeUTC: `2026-08-0${i + 1}T13:30:00Z`,
        matchIsFinished: true,
        matchResults: [{ resultName: "Endergebnis", pointsTeam1: 3, pointsTeam2: 0, resultOrderID: 2 }],
      }),
    );
    const service = new ForecastService(mockBaseXiClient([player()]), mockOpenLigaClient(finishedMatches));

    const text = await service.getMatchdayValueLineup();

    // FC Bayern München won every one of those 5-0 games at home in this fixture — strong own attack + own clean sheets.
    expect(text).toMatch(/adj \+/);
  });

  it("includes a LigaInsider reminder", async () => {
    const service = new ForecastService(mockBaseXiClient([player()]), mockOpenLigaClient());

    const text = await service.getMatchdayValueLineup();

    expect(text).toContain("site:ligainsider.de Harry Kane");
  });

  it("mentions the winner-take-all differentiation framing", async () => {
    const service = new ForecastService(mockBaseXiClient([player()]), mockOpenLigaClient());

    const text = await service.getMatchdayValueLineup();

    expect(text).toMatch(/winner-take-all/i);
  });

  describe("forecast logging", () => {
    let logDir: string;

    beforeEach(async () => {
      logDir = await mkdtemp(path.join(tmpdir(), "kickbase-forecast-service-log-"));
    });

    afterEach(async () => {
      await rm(logDir, { recursive: true, force: true });
    });

    it("saves a forecast snapshot when a matchday can be resolved from BaseXI data", async () => {
      const nextMatch = { date: "01.09.", date_iso: "2026-09-01T13:30:00", matchday: 1, home_game: true, difficulty: 2, odds: "- | - | -" };
      const service = new ForecastService(mockBaseXiClient([player({ next_match: nextMatch })]), mockOpenLigaClient(), {
        logDir,
      });

      await service.getMatchdayValueLineup();

      const pending = await loadPendingSnapshots(logDir);
      expect(pending).toHaveLength(1);
      expect(pending[0]?.matchday).toBe(1);
    });

    it("does not save a snapshot when no matchday can be resolved (next_match is null)", async () => {
      const service = new ForecastService(mockBaseXiClient([player()]), mockOpenLigaClient(), { logDir });

      await service.getMatchdayValueLineup();

      expect(await loadPendingSnapshots(logDir)).toHaveLength(0);
    });

    it("getForecastAccuracyReview reports nothing logged yet for an empty log dir", async () => {
      const service = new ForecastService(mockBaseXiClient([player()]), mockOpenLigaClient(), { logDir });

      const report = await service.getForecastAccuracyReview();

      expect(report).toMatch(/no forecasts logged yet/i);
    });
  });
});
