import { describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAnalyzePlayerValueTool,
  registerGetLeagueRankingTool,
  registerGetMySquadTool,
  registerGetPlayerInfoTool,
  registerGetSquadValuationTool,
  registerListMarketTool,
  registerMakeOfferTool,
} from "./tools.js";
import type { KickbaseService } from "./kickbase.service.js";

interface TextResult {
  content: [{ type: "text"; text: string }];
}

type Handler = (input: Record<string, unknown>) => Promise<TextResult>;

function mockService(overrides: Partial<KickbaseService> = {}): KickbaseService {
  return {
    getMarketPlayers: vi.fn(),
    getPlayerInformation: vi.fn(),
    getMySquad: vi.fn(),
    getLeagueRanking: vi.fn(),
    getPlayerValueAnalysis: vi.fn(),
    getSquadValuation: vi.fn(),
    makeOffer: vi.fn(),
    ...overrides,
  } as unknown as KickbaseService;
}

function captureHandler(register: (server: McpServer, service: KickbaseService) => void, service: KickbaseService): Handler {
  let captured: Handler | undefined;
  const serverStub = {
    registerTool: (_name: string, _config: unknown, handler: Handler) => {
      captured = handler;
    },
  } as unknown as McpServer;

  register(serverStub, service);
  if (!captured) throw new Error("registerTool was not called");
  return captured;
}

describe("registerGetPlayerInfoTool", () => {
  it("returns the service's formatted text", async () => {
    const getPlayerInformation = vi.fn().mockResolvedValue("player summary");
    const service = mockService({ getPlayerInformation });
    const handler = captureHandler(registerGetPlayerInfoTool, service);

    const result = await handler({ playerId: "42" });

    expect(getPlayerInformation).toHaveBeenCalledWith("42");
    expect(result.content[0].text).toBe("player summary");
  });
});

describe("registerListMarketTool", () => {
  it("returns the market listing text", async () => {
    const service = mockService({
      getMarketPlayers: vi.fn().mockResolvedValue("market listing"),
    });
    const handler = captureHandler(registerListMarketTool, service);

    const result = await handler({});

    expect(result.content[0].text).toBe("market listing");
  });
});

describe("registerGetMySquadTool", () => {
  it("returns the squad text", async () => {
    const service = mockService({ getMySquad: vi.fn().mockResolvedValue("squad text") });
    const handler = captureHandler(registerGetMySquadTool, service);

    const result = await handler({});

    expect(result.content[0].text).toBe("squad text");
  });
});

describe("registerGetLeagueRankingTool", () => {
  it("passes dayNumber through and returns the formatted ranking", async () => {
    const getLeagueRanking = vi.fn().mockResolvedValue("League Ranking — Matchday 3\n1. User A — 12 pts");
    const service = mockService({ getLeagueRanking });
    const handler = captureHandler(registerGetLeagueRankingTool, service);

    const result = await handler({ dayNumber: 3 });

    expect(getLeagueRanking).toHaveBeenCalledWith(3);
    expect(result.content[0].text).toContain("Matchday 3");
  });

  it("omits dayNumber for the season-overall ranking", async () => {
    const getLeagueRanking = vi.fn().mockResolvedValue("League Ranking (Season)\n1. User A — 50 pts");
    const service = mockService({ getLeagueRanking });
    const handler = captureHandler(registerGetLeagueRankingTool, service);

    await handler({});

    expect(getLeagueRanking).toHaveBeenCalledWith(undefined);
  });
});

describe("registerGetSquadValuationTool", () => {
  it("returns the service's formatted valuation text", async () => {
    const getSquadValuation = vi.fn().mockResolvedValue("Squad valuation (2 players): ...");
    const service = mockService({ getSquadValuation });
    const handler = captureHandler(registerGetSquadValuationTool, service);

    const result = await handler({});

    expect(getSquadValuation).toHaveBeenCalled();
    expect(result.content[0].text).toContain("Squad valuation");
  });
});

describe("registerAnalyzePlayerValueTool", () => {
  it("passes playerId and consideredPrice through to the service", async () => {
    const getPlayerValueAnalysis = vi.fn().mockResolvedValue("fair value text");
    const service = mockService({ getPlayerValueAnalysis });
    const handler = captureHandler(registerAnalyzePlayerValueTool, service);

    const result = await handler({ playerId: "42", consideredPrice: 900_000 });

    expect(getPlayerValueAnalysis).toHaveBeenCalledWith("42", 900_000);
    expect(result.content[0].text).toBe("fair value text");
  });

  it("passes undefined consideredPrice through when omitted", async () => {
    const getPlayerValueAnalysis = vi.fn().mockResolvedValue("fair value text");
    const service = mockService({ getPlayerValueAnalysis });
    const handler = captureHandler(registerAnalyzePlayerValueTool, service);

    await handler({ playerId: "42" });

    expect(getPlayerValueAnalysis).toHaveBeenCalledWith("42", undefined);
  });
});

describe("registerMakeOfferTool", () => {
  it("does NOT call the service and returns a dry-run preview when confirm is omitted", async () => {
    const makeOffer = vi.fn();
    const service = mockService({ makeOffer });
    const handler = captureHandler(registerMakeOfferTool, service);

    const result = await handler({ playerId: "7", price: 1000 });

    expect(makeOffer).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("DRY RUN");
    expect(result.content[0].text).toContain("7");
    expect(result.content[0].text).toContain("1000");
  });

  it("does NOT call the service when confirm is explicitly false", async () => {
    const makeOffer = vi.fn();
    const service = mockService({ makeOffer });
    const handler = captureHandler(registerMakeOfferTool, service);

    await handler({ playerId: "7", price: 1000, confirm: false });

    expect(makeOffer).not.toHaveBeenCalled();
  });

  it("calls the service and confirms execution only when confirm is true", async () => {
    const makeOffer = vi.fn();
    const service = mockService({ makeOffer });
    const handler = captureHandler(registerMakeOfferTool, service);

    const result = await handler({ playerId: "7", price: 1000, confirm: true });

    expect(makeOffer).toHaveBeenCalledWith("7", 1000);
    expect(result.content[0].text).toContain("submitted successfully");
  });
});
