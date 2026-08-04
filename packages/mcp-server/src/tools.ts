import { z } from "zod";
import type { KickbaseService } from "./kickbase.service.js";
import { ToolResponseBuilder, type ToolTextResponse } from "./response-builder.js";

interface ToolDefinition<TInput> {
  name: string;
  config: {
    title: string;
    description: string;
    inputSchema: Record<string, z.ZodTypeAny>;
  };
  handler: (input: TInput) => Promise<ToolTextResponse>;
}

export function createGetPlayerInfoTool(
  kickbaseService: KickbaseService,
): ToolDefinition<{ playerId: string }> {
  return {
    name: "get-kickbase-player-information",
    config: {
      title: "Get information about a kickbase player based on their id",
      description:
        "Get information, such as performance and market value data about a player based on playerId",
      inputSchema: { playerId: z.string() },
    },
    handler: async ({ playerId }) => {
      const text = await kickbaseService.getPlayerInformation(playerId);
      return ToolResponseBuilder.createTextResponse(text);
    },
  };
}

export function createListMarketTool(kickbaseService: KickbaseService): ToolDefinition<object> {
  return {
    name: "list-kickbase-market",
    config: {
      title: "List players that are currently on the kickbase market",
      description: "Returns players that are currently listed on the kickbase market and can be bought",
      inputSchema: {},
    },
    handler: async () => {
      const playersFound = await kickbaseService.getMarketPlayers();
      return ToolResponseBuilder.createTextResponse(playersFound);
    },
  };
}

export function createGetMySquadTool(kickbaseService: KickbaseService): ToolDefinition<object> {
  return {
    name: "get-my-kickbase-squad",
    config: {
      title: "Get my current Kickbase squad",
      description: "Returns all players currently in my squad/team",
      inputSchema: {},
    },
    handler: async () => {
      const squad = await kickbaseService.getMySquad();
      return ToolResponseBuilder.createTextResponse(squad);
    },
  };
}

/**
 * make-offer is budget- and standing-affecting (see CLAUDE.md guardrails).
 * Default is a dry run that echoes back exactly what would happen; the
 * transaction only executes when the caller explicitly passes confirm: true.
 * This is the fix for upstream finding #6 (no confirmation before spending money).
 */
export function createMakeOfferTool(
  kickbaseService: KickbaseService,
): ToolDefinition<{ playerId: string; price: number; confirm?: boolean }> {
  return {
    name: "make-kickbase-offer-for-player",
    config: {
      title: "Make an offer in kickbase for a given player",
      description:
        "Prepares (and, only with confirm: true, submits) an offer for a player at a given " +
        "price. Defaults to a dry run — call once without confirm to preview, then again " +
        "with confirm: true to actually place the offer.",
      inputSchema: {
        playerId: z.string(),
        price: z.number().positive(),
        confirm: z.boolean().optional(),
      },
    },
    handler: async ({ playerId, price, confirm }) => {
      if (!confirm) {
        return ToolResponseBuilder.createTextResponse(
          `DRY RUN — no offer submitted. This would place an offer of ${price} on player ` +
            `${playerId}. To actually submit this offer, call this tool again with confirm: true.`,
        );
      }

      await kickbaseService.makeOffer(playerId, price);
      return ToolResponseBuilder.createTextResponse(
        `Offer of ${price} for player ${playerId} was submitted successfully.`,
      );
    },
  };
}
