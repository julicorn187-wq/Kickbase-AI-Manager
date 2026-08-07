import { describe, expect, it, vi } from "vitest";
import { MatchupService } from "./matchup.service.js";
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

function mockClient(overrides: Partial<OpenLigaDbClient> = {}): OpenLigaDbClient {
  return {
    getSeasonMatches: vi.fn().mockResolvedValue([]),
    getAvailableLeagues: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as OpenLigaDbClient;
}

describe("MatchupService", () => {
  it("returns a friendly message when no team matches", async () => {
    const client = mockClient({ getSeasonMatches: vi.fn().mockResolvedValue([bundesligaMatch()]) });
    const service = new MatchupService(client);

    const text = await service.getTeamMatchupAnalysis("Nonexistent FC");

    expect(text).toMatch(/no bundesliga team matching/i);
  });

  it("matches a team by its short name and reports recent form", async () => {
    const client = mockClient({
      getSeasonMatches: vi.fn().mockResolvedValue([
        bundesligaMatch({
          matchDateTimeUTC: "2026-08-01T13:30:00Z",
          matchIsFinished: true,
          matchResults: [{ resultName: "Endergebnis", pointsTeam1: 3, pointsTeam2: 1, resultOrderID: 2 }],
        }),
        bundesligaMatch({
          matchDateTimeUTC: "2026-08-15T13:30:00Z",
          team1: team(6, "Bayer 04 Leverkusen", "Leverkusen"),
          team2: team(40, "FC Bayern München", "Bayern"),
          matchIsFinished: false,
        }),
      ]),
    });
    const service = new MatchupService(client);

    const text = await service.getTeamMatchupAnalysis("Bayern");

    expect(text).toContain("Matchup analysis for FC Bayern München");
    expect(text).toContain("1W-0D-0L");
    expect(text).toContain("at Bayer 04 Leverkusen");
  });

  it("flags fixture congestion across the Bundesliga and a matched cup competition", async () => {
    const client = mockClient({
      getSeasonMatches: vi
        .fn()
        .mockImplementation((shortcut: string) =>
          Promise.resolve(
            shortcut === "bl1"
              ? [bundesligaMatch({ matchDateTimeUTC: "2026-08-10T13:30:00Z" })]
              : [
                  bundesligaMatch({
                    matchDateTimeUTC: "2026-08-12T19:00:00Z",
                    team1: team(40, "FC Bayern München", "Bayern"),
                    team2: team(999, "Some CL Team", "CLTeam"),
                  }),
                ],
          ),
        ),
      getAvailableLeagues: vi
        .fn()
        .mockResolvedValue([
          { leagueShortcut: "ucl", leagueName: "Champions League 2026/2027", leagueSeason: 2026 },
        ]),
    });
    const service = new MatchupService(client);

    const text = await service.getTeamMatchupAnalysis("Bayern");

    expect(text).toContain("Fixture congestion:");
    expect(text).toContain("Double burden: 2 matches");
    expect(text).toContain("Champions League");
  });

  it("degrades gracefully when the cup-competition lookup fails", async () => {
    const client = mockClient({
      getSeasonMatches: vi.fn().mockResolvedValue([bundesligaMatch()]),
      getAvailableLeagues: vi.fn().mockRejectedValue(new Error("network down")),
    });
    const service = new MatchupService(client);

    const text = await service.getTeamMatchupAnalysis("Bayern");

    expect(text).toContain("Matchup analysis for FC Bayern München");
    expect(text).toContain("checked: Bundesliga)");
  });

  it("includes a LigaInsider search suggestion", async () => {
    const client = mockClient({ getSeasonMatches: vi.fn().mockResolvedValue([bundesligaMatch()]) });
    const service = new MatchupService(client);

    const text = await service.getTeamMatchupAnalysis("Bayern");

    expect(text).toContain("site:ligainsider.de FC Bayern München");
  });
});
