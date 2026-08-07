import { describe, expect, it, vi } from "vitest";
import { KickbaseService } from "./kickbase.service.js";
import type { KickbaseApiClient } from "@kickbase-ai-manager/kickbase-api";

function mockApiClient(overrides: Partial<KickbaseApiClient> = {}): KickbaseApiClient {
  return {
    getMarketPlayers: vi.fn(),
    getPlayerData: vi.fn(),
    getPlayerMarketValue: vi.fn(),
    getMySquad: vi.fn(),
    getLeagueRanking: vi.fn(),
    makeOffer: vi.fn(),
    ...overrides,
  } as unknown as KickbaseApiClient;
}

describe("KickbaseService", () => {
  it("formats market players sorted by soonest expiry, respecting the limit", async () => {
    const apiClient = mockApiClient({
      getMarketPlayers: vi.fn().mockResolvedValue({
        it: [
          { fn: "A", n: "One", mv: 100, i: "1", exs: 600 },
          { fn: "B", n: "Two", mv: 200, i: "2", exs: 60 },
        ],
      }),
    });
    const service = new KickbaseService(apiClient);

    const text = await service.getMarketPlayers(1);

    expect(text).toContain("B Two");
    expect(text).not.toContain("A One");
  });

  it("returns a friendly message when the market is empty", async () => {
    const apiClient = mockApiClient({ getMarketPlayers: vi.fn().mockResolvedValue({ it: [] }) });
    const service = new KickbaseService(apiClient);

    expect(await service.getMarketPlayers()).toMatch(/no players/i);
  });

  it("computes 1-day and 7-day market value trends from real entries only", async () => {
    const apiClient = mockApiClient({
      getPlayerData: vi.fn().mockResolvedValue({
        fn: "Max",
        ln: "Muster",
        tn: "FCB",
        mv: 500,
        tp: 100,
        ap: 5,
        ph: [{ p: 3 }, { p: 4 }, { p: 5 }],
      }),
      getPlayerMarketValue: vi.fn().mockResolvedValue({
        it: [{ mv: 100 }, { mv: 110 }, { mv: 130 }],
      }),
    });
    const service = new KickbaseService(apiClient);

    const text = await service.getPlayerInformation("1");

    expect(text).toContain("1-day market value trend: 20");
    expect(text).toContain("7-day market value trend: 30");
  });

  it("formats squad players with resolved position names", async () => {
    const apiClient = mockApiClient({
      getMySquad: vi.fn().mockResolvedValue({
        it: [
          {
            ap: 5,
            i: "1",
            iotm: false,
            lo: 0,
            lst: 0,
            mdst: 0,
            mv: 1000,
            mvgl: 0,
            mvt: 0,
            n: "Player One",
            ofc: 0,
            p: 10,
            pos: 4,
            sdmvt: 0,
            st: 0,
            tfhmvt: 0,
            tid: "team-1",
          },
        ],
        mppu: 3,
      }),
    });
    const service = new KickbaseService(apiClient);

    const text = await service.getMySquad();

    expect(text).toContain("Player One (ATT)");
    expect(text).toContain("Max players per team: 3");
  });

  it("formats the season ranking sorted by placement", async () => {
    const apiClient = mockApiClient({
      getLeagueRanking: vi.fn().mockResolvedValue({
        us: [
          { i: "u1", n: "User A", sp: 50, spl: 2 },
          { i: "u2", n: "User B", sp: 80, spl: 1 },
        ],
      }),
    });
    const service = new KickbaseService(apiClient);

    const text = await service.getLeagueRanking();

    expect(text).toContain("League Ranking (Season)");
    const lines = text.split("\n");
    expect(lines[1]).toContain("User B");
    expect(lines[2]).toContain("User A");
  });

  it("formats a matchday ranking using mdp/mdpl fields when dayNumber is given", async () => {
    const getLeagueRanking = vi.fn().mockResolvedValue({
      us: [{ i: "u1", n: "User A", mdp: 12, mdpl: 1 }],
    });
    const apiClient = mockApiClient({ getLeagueRanking });
    const service = new KickbaseService(apiClient);

    const text = await service.getLeagueRanking(5);

    expect(getLeagueRanking).toHaveBeenCalledWith(5);
    expect(text).toContain("Matchday 5");
    expect(text).toContain("User A — 12 pts");
  });

  it("returns a friendly message when the ranking is empty", async () => {
    const apiClient = mockApiClient({ getLeagueRanking: vi.fn().mockResolvedValue({ us: [] }) });
    const service = new KickbaseService(apiClient);

    expect(await service.getLeagueRanking()).toMatch(/no ranking data/i);
  });

  it("delegates makeOffer to the api client", async () => {
    const makeOffer = vi.fn();
    const apiClient = mockApiClient({ makeOffer });
    const service = new KickbaseService(apiClient);

    await service.makeOffer("1", 500);

    expect(makeOffer).toHaveBeenCalledWith("1", 500);
  });
});
