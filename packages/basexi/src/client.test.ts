import { describe, expect, it, vi } from "vitest";
import { BaseXiClient } from "./client.js";
import { BaseXiApiError, BaseXiNetworkError, BaseXiParseError } from "./errors.js";
import type { BaseXiPlayer, BaseXiPlayerDetail } from "./types.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function client(fetchImpl: typeof fetch, overrides: Partial<{ maxRetries: number }> = {}): BaseXiClient {
  return new BaseXiClient({ fetchImpl, maxRetries: overrides.maxRetries ?? 0, timeoutMs: 1000 });
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
    status: 0,
    statusText: null,
    isHot: false,
    matchesPlayed: 0,
    gamesPrevSeason: 31,
    momentum: "dark_green",
    match_data: { home_game: true, next_opponent: "VfB Stuttgart", odds: "- | - | -" },
    next_match: null,
    ...overrides,
  };
}

describe("BaseXiClient", () => {
  it("fetches from the correct endpoint", async () => {
    const fetchMock = vi.fn((url: string) => {
      expect(url).toBe("https://www.base-xi.de/api/players");
      return jsonResponse([player()]);
    });

    const result = await client(fetchMock as unknown as typeof fetch).getAllPlayers();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Harry Kane");
  });

  it("finds a player by case-insensitive substring match", async () => {
    const fetchMock = vi.fn(() => jsonResponse([player(), player({ id: "2", name: "Deniz Undav" })]));

    const found = await client(fetchMock as unknown as typeof fetch).findPlayer("undav");
    expect(found?.name).toBe("Deniz Undav");
  });

  it("returns undefined when no player matches", async () => {
    const fetchMock = vi.fn(() => jsonResponse([player()]));

    const found = await client(fetchMock as unknown as typeof fetch).findPlayer("nonexistent");
    expect(found).toBeUndefined();
  });

  it("wraps a malformed JSON body in BaseXiParseError", async () => {
    const fetchMock = vi.fn(() => new Response("not json", { status: 200 }));

    await expect(client(fetchMock as unknown as typeof fetch).getAllPlayers()).rejects.toThrow(BaseXiParseError);
  });

  it("wraps a persistent network failure in BaseXiNetworkError", async () => {
    const fetchMock = vi.fn(() => {
      throw new TypeError("fetch failed");
    });

    await expect(client(fetchMock as unknown as typeof fetch).getAllPlayers()).rejects.toThrow(BaseXiNetworkError);
  });

  describe("getPlayerDetail", () => {
    function detail(overrides: Partial<BaseXiPlayerDetail> = {}): BaseXiPlayerDetail {
      return {
        id: "7226",
        name: "Harry Kane",
        position: "Sturm",
        teamName: "FC Bayern München",
        marketValue: 68_379_524,
        status: 0,
        matchHistory: [{ day: 1, oppId: 9, points: null, result: null }],
        matchHistoryPrev: [
          { day: 1, oppId: 43, points: 427, result: "win" },
          { day: 2, oppId: 13, points: null, result: null },
        ],
        seasonLabels: { current: "2026/27", prev: "2025/26" },
        nextMatch: { day: 1, home: true, oppId: 9, difficulty: 1, odds: "1.27 | 7.0 | 7.5", dateStr: "28.08. 19:30" },
        ...overrides,
      };
    }

    it("fetches the modal endpoint with the given player id and competition", async () => {
      const fetchMock = vi.fn((url: string) => {
        expect(url).toBe("https://www.base-xi.de/api/modal/player/7226?comp=1");
        return jsonResponse({ success: true, data: detail() });
      });

      const result = await client(fetchMock as unknown as typeof fetch).getPlayerDetail("7226");
      expect(result.name).toBe("Harry Kane");
      expect(result.matchHistoryPrev[0]).toEqual({ day: 1, oppId: 43, points: 427, result: "win" });
    });

    it("passes comp=2 through to the endpoint", async () => {
      const fetchMock = vi.fn((url: string) => {
        expect(url).toBe("https://www.base-xi.de/api/modal/player/99?comp=2");
        return jsonResponse({ success: true, data: detail({ id: "99" }) });
      });

      await client(fetchMock as unknown as typeof fetch).getPlayerDetail("99", 2);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("preserves null points for matchdays the player didn't play, rather than inventing zero", async () => {
      const fetchMock = vi.fn(() => jsonResponse({ success: true, data: detail() }));

      const result = await client(fetchMock as unknown as typeof fetch).getPlayerDetail("7226");
      expect(result.matchHistoryPrev[1]?.points).toBeNull();
    });

    it("throws BaseXiApiError when the API reports success: false", async () => {
      const fetchMock = vi.fn(() => jsonResponse({ success: false, error: "player not found" }));

      await expect(client(fetchMock as unknown as typeof fetch).getPlayerDetail("nonexistent")).rejects.toThrow(
        BaseXiApiError,
      );
    });
  });
});
