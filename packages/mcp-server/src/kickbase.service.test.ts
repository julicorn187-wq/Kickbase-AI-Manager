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

  it("returns a friendly message for squad valuation when the squad is empty", async () => {
    const apiClient = mockApiClient({ getMySquad: vi.fn().mockResolvedValue({ it: [], mppu: 3 }) });
    const service = new KickbaseService(apiClient);

    expect(await service.getSquadValuation()).toMatch(/squad is currently empty/i);
  });

  it("aggregates squad valuation totals, position breakdown, and attention list", async () => {
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
            mv: 1_000_000,
            mvgl: 50_000,
            mvt: 0,
            n: "Fit Player",
            ofc: 0,
            p: 40,
            pos: 4,
            sdmvt: 0,
            st: 0,
            tfhmvt: 0,
            tid: "team-1",
          },
          {
            ap: 3,
            i: "2",
            iotm: false,
            lo: 0,
            lst: 0,
            mdst: 0,
            mv: 500_000,
            mvgl: -10_000,
            mvt: 0,
            n: "Hurt Player",
            ofc: 0,
            p: 20,
            pos: 2,
            sdmvt: 0,
            st: 1,
            tfhmvt: 0,
            tid: "team-2",
          },
        ],
        mppu: 3,
      }),
    });
    const service = new KickbaseService(apiClient);

    const text = await service.getSquadValuation();

    expect(text).toContain("Squad valuation (2 players)");
    expect(text).toContain("Total market value: 1500000");
    expect(text).toContain("Total value gain/loss since acquisition: +40000");
    expect(text).toContain("Total points: 60 (avg 30.0 per player)");
    expect(text).toContain("ATT: 1 players, 1000000 total value");
    expect(text).toContain("DEF: 1 players, 500000 total value");
    expect(text).toContain("Hurt Player: status=1, matchdayStatus=0");
    expect(text).not.toContain("Fit Player: status");
  });

  it("returns a friendly message for the squad report when the squad is empty", async () => {
    const apiClient = mockApiClient({ getMySquad: vi.fn().mockResolvedValue({ it: [], mppu: 3 }) });
    const service = new KickbaseService(apiClient);

    expect(await service.getSquadReport()).toMatch(/squad is currently empty/i);
  });

  it("builds a squad report combining the valuation with recommendations", async () => {
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
            mv: 1_000_000,
            mvgl: 50_000,
            mvt: 0,
            n: "Fit Player",
            ofc: 0,
            p: 40,
            pos: 4,
            sdmvt: 0,
            st: 0,
            tfhmvt: 0,
            tid: "team-1",
          },
          {
            ap: 3,
            i: "2",
            iotm: false,
            lo: 0,
            lst: 0,
            mdst: 0,
            mv: 500_000,
            mvgl: -10_000,
            mvt: 0,
            n: "Hurt Player",
            ofc: 0,
            p: 20,
            pos: 2,
            sdmvt: 0,
            st: 1,
            tfhmvt: 0,
            tid: "team-2",
          },
        ],
        mppu: 3,
      }),
    });
    const service = new KickbaseService(apiClient);

    const text = await service.getSquadReport();

    expect(text).toContain("Squad valuation (2 players)");
    expect(text).toContain("Recommendations:");
    expect(text).toContain("Hurt Player has lost 10000 in value");
    expect(text).toContain("Hurt Player has a non-default status code");
    expect(text).toContain("site:ligainsider.de Hurt Player");
    expect(text).not.toContain("Fit Player has lost");
  });

  it("estimates a fair value and states a buy-up-to price", async () => {
    const apiClient = mockApiClient({
      getPlayerData: vi.fn().mockResolvedValue({
        fn: "Max",
        ln: "Muster",
        tn: "FCB",
        mv: 1_000_000,
        tp: 100,
        ap: 5,
        ph: [],
      }),
      getPlayerMarketValue: vi.fn().mockResolvedValue({
        it: [{ mv: 900_000 }, { mv: 1_000_000 }],
      }),
    });
    const service = new KickbaseService(apiClient);

    const text = await service.getPlayerValueAnalysis("1");

    expect(text).toContain("Max Muster (FCB)");
    expect(text).toContain("Current market value: 1000000");
    expect(text).toContain("Estimated fair value: 1050000");
    expect(text).toContain("buy is reasonable up to 1050000");
  });

  it("adds an explicit BUY verdict when consideredPrice is at or below the fair value", async () => {
    const apiClient = mockApiClient({
      getPlayerData: vi.fn().mockResolvedValue({
        fn: "Max",
        ln: "Muster",
        tn: "FCB",
        mv: 1_000_000,
        tp: 100,
        ap: 5,
        ph: [],
      }),
      getPlayerMarketValue: vi.fn().mockResolvedValue({ it: [] }),
    });
    const service = new KickbaseService(apiClient);

    const text = await service.getPlayerValueAnalysis("1", 900_000);

    expect(text).toContain("At a price of 900000: BUY");
  });

  it("adds an explicit TOO EXPENSIVE verdict when consideredPrice exceeds the fair value", async () => {
    const apiClient = mockApiClient({
      getPlayerData: vi.fn().mockResolvedValue({
        fn: "Max",
        ln: "Muster",
        tn: "FCB",
        mv: 1_000_000,
        tp: 100,
        ap: 5,
        ph: [],
      }),
      getPlayerMarketValue: vi.fn().mockResolvedValue({ it: [] }),
    });
    const service = new KickbaseService(apiClient);

    const text = await service.getPlayerValueAnalysis("1", 1_500_000);

    expect(text).toContain("At a price of 1500000: TOO EXPENSIVE");
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
