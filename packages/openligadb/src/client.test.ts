import { describe, expect, it, vi } from "vitest";
import { OpenLigaDbClient } from "./client.js";
import { OpenLigaNetworkError, OpenLigaParseError } from "./errors.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function client(fetchImpl: typeof fetch, overrides: Partial<{ maxRetries: number }> = {}): OpenLigaDbClient {
  return new OpenLigaDbClient({
    fetchImpl,
    maxRetries: overrides.maxRetries ?? 0,
    timeoutMs: 1000,
  });
}

describe("OpenLigaDbClient", () => {
  it("fetches season matches from the correct endpoint", async () => {
    const fetchMock = vi.fn((url: string) => {
      expect(url).toBe("https://api.openligadb.de/getmatchdata/bl1/2026");
      return jsonResponse([{ matchID: 1 }]);
    });

    const result = await client(fetchMock as unknown as typeof fetch).getSeasonMatches("bl1", 2026);
    expect(result).toEqual([{ matchID: 1 }]);
  });

  it("fetches available leagues from the correct endpoint", async () => {
    const fetchMock = vi.fn((url: string) => {
      expect(url).toBe("https://api.openligadb.de/getavailableleagues");
      return jsonResponse([{ leagueShortcut: "bl1", leagueName: "Bundesliga", leagueSeason: 2026 }]);
    });

    const result = await client(fetchMock as unknown as typeof fetch).getAvailableLeagues();
    expect(result).toHaveLength(1);
  });

  it("retries a transient 5xx error and succeeds on a later attempt", async () => {
    let calls = 0;
    const fetchMock = vi.fn(() => {
      calls++;
      if (calls < 2) return jsonResponse({ error: "unavailable" }, 503);
      return jsonResponse([]);
    });

    const result = await client(fetchMock as unknown as typeof fetch, { maxRetries: 2 }).getSeasonMatches(
      "bl1",
      2026,
    );

    expect(result).toEqual([]);
    expect(calls).toBe(2);
  });

  it("wraps a malformed JSON body in OpenLigaParseError", async () => {
    const fetchMock = vi.fn(() => new Response("not json", { status: 200 }));

    await expect(client(fetchMock as unknown as typeof fetch).getSeasonMatches("bl1", 2026)).rejects.toThrow(
      OpenLigaParseError,
    );
  });

  it("wraps a persistent network failure in OpenLigaNetworkError", async () => {
    const fetchMock = vi.fn(() => {
      throw new TypeError("fetch failed");
    });

    await expect(client(fetchMock as unknown as typeof fetch).getSeasonMatches("bl1", 2026)).rejects.toThrow(
      OpenLigaNetworkError,
    );
  });
});
