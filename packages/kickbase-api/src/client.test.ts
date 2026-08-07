import { describe, expect, it, vi } from "vitest";
import { KickbaseApiClient } from "./client.js";
import { KickbaseAuthError, KickbaseNetworkError, KickbaseParseError } from "./errors.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function client(fetchImpl: typeof fetch, overrides: Partial<{ maxRetries: number }> = {}) {
  return new KickbaseApiClient({
    cookie: "test-cookie",
    leagueId: "league-1",
    fetchImpl,
    maxRetries: overrides.maxRetries ?? 0,
    timeoutMs: 1000,
  });
}

describe("KickbaseApiClient", () => {
  it("returns parsed JSON on success and sends the cookie header", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.Cookie).toBe("test-cookie");
      return jsonResponse({ it: [] });
    });

    const result = await client(fetchMock as unknown as typeof fetch).getMarketPlayers();
    expect(result).toEqual({ it: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("scopes requests to the configured league id in the URL", async () => {
    const fetchMock = vi.fn((url: string) => {
      expect(url).toContain("/leagues/league-1/squad");
      return jsonResponse({ it: [], mppu: 3 });
    });

    await client(fetchMock as unknown as typeof fetch).getMySquad();
  });

  it("throws KickbaseAuthError on 401 without retrying", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ error: "unauthorized" }, 401));

    await expect(
      client(fetchMock as unknown as typeof fetch, { maxRetries: 2 }).getMySquad(),
    ).rejects.toThrow(KickbaseAuthError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws for a non-2xx, non-auth status without retries configured", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ error: "boom" }, 500));

    await expect(client(fetchMock as unknown as typeof fetch).getMarketPlayers()).rejects.toThrow(
      /status 500/,
    );
  });

  it("retries transient 5xx errors and succeeds on a later attempt", async () => {
    let calls = 0;
    const fetchMock = vi.fn(() => {
      calls++;
      if (calls < 3) return jsonResponse({ error: "unavailable" }, 503);
      return jsonResponse({ it: [] });
    });

    const result = await client(fetchMock as unknown as typeof fetch, {
      maxRetries: 3,
    }).getMarketPlayers();

    expect(result).toEqual({ it: [] });
    expect(calls).toBe(3);
  });

  it("wraps a malformed JSON body in KickbaseParseError", async () => {
    const fetchMock = vi.fn(() => new Response("not json", { status: 200 }));

    await expect(client(fetchMock as unknown as typeof fetch).getMarketPlayers()).rejects.toThrow(
      KickbaseParseError,
    );
  });

  it("wraps a persistent network failure in KickbaseNetworkError", async () => {
    const fetchMock = vi.fn(() => {
      throw new TypeError("fetch failed");
    });

    await expect(client(fetchMock as unknown as typeof fetch).getMarketPlayers()).rejects.toThrow(
      KickbaseNetworkError,
    );
  });
});
