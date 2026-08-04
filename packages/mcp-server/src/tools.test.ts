import { describe, expect, it, vi } from "vitest";
import {
  createGetMySquadTool,
  createGetPlayerInfoTool,
  createListMarketTool,
  createMakeOfferTool,
} from "./tools.js";
import type { KickbaseService } from "./kickbase.service.js";

function mockService(overrides: Partial<KickbaseService> = {}): KickbaseService {
  return {
    getMarketPlayers: vi.fn(),
    getPlayerInformation: vi.fn(),
    getMySquad: vi.fn(),
    makeOffer: vi.fn(),
    ...overrides,
  } as unknown as KickbaseService;
}

describe("createGetPlayerInfoTool", () => {
  it("returns the service's formatted text", async () => {
    const service = mockService({
      getPlayerInformation: vi.fn().mockResolvedValue("player summary"),
    });
    const tool = createGetPlayerInfoTool(service);

    const result = await tool.handler({ playerId: "42" });

    expect(service.getPlayerInformation).toHaveBeenCalledWith("42");
    expect(result.content[0].text).toBe("player summary");
  });
});

describe("createListMarketTool", () => {
  it("returns the market listing text", async () => {
    const service = mockService({
      getMarketPlayers: vi.fn().mockResolvedValue("market listing"),
    });
    const tool = createListMarketTool(service);

    const result = await tool.handler({});

    expect(result.content[0].text).toBe("market listing");
  });
});

describe("createGetMySquadTool", () => {
  it("returns the squad text", async () => {
    const service = mockService({ getMySquad: vi.fn().mockResolvedValue("squad text") });
    const tool = createGetMySquadTool(service);

    const result = await tool.handler({});

    expect(result.content[0].text).toBe("squad text");
  });
});

describe("createMakeOfferTool", () => {
  it("does NOT call the service and returns a dry-run preview when confirm is omitted", async () => {
    const service = mockService();
    const tool = createMakeOfferTool(service);

    const result = await tool.handler({ playerId: "7", price: 1000 });

    expect(service.makeOffer).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("DRY RUN");
    expect(result.content[0].text).toContain("7");
    expect(result.content[0].text).toContain("1000");
  });

  it("does NOT call the service when confirm is explicitly false", async () => {
    const service = mockService();
    const tool = createMakeOfferTool(service);

    await tool.handler({ playerId: "7", price: 1000, confirm: false });

    expect(service.makeOffer).not.toHaveBeenCalled();
  });

  it("calls the service and confirms execution only when confirm is true", async () => {
    const service = mockService();
    const tool = createMakeOfferTool(service);

    const result = await tool.handler({ playerId: "7", price: 1000, confirm: true });

    expect(service.makeOffer).toHaveBeenCalledWith("7", 1000);
    expect(result.content[0].text).toContain("submitted successfully");
  });
});
