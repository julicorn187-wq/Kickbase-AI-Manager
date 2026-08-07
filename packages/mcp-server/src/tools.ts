import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KickbaseService } from "./kickbase.service.js";
import { createTextResponse } from "./response-builder.js";

export function registerGetPlayerInfoTool(server: McpServer, kickbaseService: KickbaseService): void {
  server.registerTool(
    "get-kickbase-player-information",
    {
      title: "Get information about a kickbase player based on their id",
      description:
        "Get information, such as performance and market value data about a player based on playerId",
      inputSchema: { playerId: z.string() },
    },
    async ({ playerId }) => createTextResponse(await kickbaseService.getPlayerInformation(playerId)),
  );
}

export function registerListMarketTool(server: McpServer, kickbaseService: KickbaseService): void {
  server.registerTool(
    "list-kickbase-market",
    {
      title: "List players that are currently on the kickbase market",
      description: "Returns players that are currently listed on the kickbase market and can be bought",
      inputSchema: {},
    },
    async () => createTextResponse(await kickbaseService.getMarketPlayers()),
  );
}

export function registerGetMySquadTool(server: McpServer, kickbaseService: KickbaseService): void {
  server.registerTool(
    "get-my-kickbase-squad",
    {
      title: "Get my current Kickbase squad",
      description: "Returns all players currently in my squad/team",
      inputSchema: {},
    },
    async () => createTextResponse(await kickbaseService.getMySquad()),
  );
}

export function registerGetLeagueRankingTool(server: McpServer, kickbaseService: KickbaseService): void {
  server.registerTool(
    "get-kickbase-league-ranking",
    {
      title: "Get the Kickbase league ranking table",
      description:
        "Returns the league standings: manager names, points and placement. Omit dayNumber " +
        "for the season-overall ranking, or pass it to get a single matchday's standings.",
      inputSchema: { dayNumber: z.number().int().positive().optional() },
    },
    async ({ dayNumber }) => createTextResponse(await kickbaseService.getLeagueRanking(dayNumber)),
  );
}

/**
 * make-offer is budget- and standing-affecting (see CLAUDE.md guardrails).
 * Default is a dry run that echoes back exactly what would happen; the
 * transaction only executes when the caller explicitly passes confirm: true.
 * This is the fix for upstream finding #6 (no confirmation before spending money).
 */
export function registerMakeOfferTool(server: McpServer, kickbaseService: KickbaseService): void {
  server.registerTool(
    "make-kickbase-offer-for-player",
    {
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
    async ({ playerId, price, confirm }) => {
      if (!confirm) {
        return createTextResponse(
          `DRY RUN — no offer submitted. This would place an offer of ${price} on player ` +
            `${playerId}. To actually submit this offer, call this tool again with confirm: true.`,
        );
      }

      await kickbaseService.makeOffer(playerId, price);
      return createTextResponse(`Offer of ${price} for player ${playerId} was submitted successfully.`);
    },
  );
}
