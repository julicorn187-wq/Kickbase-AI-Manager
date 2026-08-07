import { describe, expect, it, vi } from "vitest";
import { BaseXiService } from "./basexi.service.js";
import type { BaseXiClient, BaseXiPlayer } from "@kickbase-ai-manager/basexi";

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

function mockClient(overrides: Partial<BaseXiClient> = {}): BaseXiClient {
  return { getAllPlayers: vi.fn(), findPlayer: vi.fn(), ...overrides } as unknown as BaseXiClient;
}

describe("BaseXiService", () => {
  it("returns a friendly message when no player matches", async () => {
    const client = mockClient({ findPlayer: vi.fn().mockResolvedValue(undefined) });
    const service = new BaseXiService(client);

    expect(await service.getPlayerSnapshot("Nonexistent")).toMatch(/no basexi entry found/i);
  });

  it("formats a found player's snapshot including source disclosure", async () => {
    const client = mockClient({ findPlayer: vi.fn().mockResolvedValue(player()) });
    const service = new BaseXiService(client);

    const text = await service.getPlayerSnapshot("Kane");

    expect(text).toContain("Harry Kane (Sturm, FC Bayern München)");
    expect(text).toContain("Market value: 68000000");
    expect(text).toContain("vs VfB Stuttgart");
    expect(text).toContain("base-xi.de");
    expect(text).not.toContain("odds home|draw|away"); // placeholder odds omitted
  });

  it("includes odds when they are actually posted", async () => {
    const client = mockClient({
      findPlayer: vi.fn().mockResolvedValue(
        player({ match_data: { home_game: true, next_opponent: "VfB Stuttgart", odds: "2.10 | 3.40 | 3.20" } }),
      ),
    });
    const service = new BaseXiService(client);

    const text = await service.getPlayerSnapshot("Kane");

    expect(text).toContain("odds home|draw|away: 2.10 | 3.40 | 3.20");
  });

  it("marks trending-hot players", async () => {
    const client = mockClient({ findPlayer: vi.fn().mockResolvedValue(player({ isHot: true })) });
    const service = new BaseXiService(client);

    expect(await service.getPlayerSnapshot("Kane")).toContain("trending hot");
  });
});
