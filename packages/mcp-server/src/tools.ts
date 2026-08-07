import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KickbaseService } from "./kickbase.service.js";
import type { MatchupService } from "./matchup.service.js";
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

export function registerGetSquadValuationTool(server: McpServer, kickbaseService: KickbaseService): void {
  server.registerTool(
    "get-kickbase-squad-valuation",
    {
      title: "Get a valuation summary of my Kickbase squad",
      description:
        "Aggregates the squad into total market value, value gain/loss since acquisition, " +
        "points, a per-position breakdown, and a list of players with a non-default status " +
        "code worth a manual look. Status codes are shown raw (their exact meaning is not " +
        "confirmed for this API), not interpreted as e.g. 'injured'.",
      inputSchema: {},
    },
    async () => createTextResponse(await kickbaseService.getSquadValuation()),
  );
}

export function registerGetSquadReportTool(server: McpServer, kickbaseService: KickbaseService): void {
  server.registerTool(
    "get-kickbase-squad-report",
    {
      title: "Get a squad report with recommendations",
      description:
        "The squad valuation plus a Recommendations section: for players that have lost market " +
        "value since acquisition or carry a non-default status code, suggests checking their " +
        "fair value and searching LigaInsider for context before deciding anything. Every " +
        "recommendation is a 'go check X', not a decision made for you.",
      inputSchema: {},
    },
    async () => createTextResponse(await kickbaseService.getSquadReport()),
  );
}

/**
 * Read-only analysis tool: estimates a fair value for a player from their
 * current market value and 7-day trend, and states up to what price a buy
 * is reasonable. See KickbaseService.getPlayerValueAnalysis and
 * packages/market/src/fair-value.ts for the method and its caveats.
 */
export function registerAnalyzePlayerValueTool(
  server: McpServer,
  kickbaseService: KickbaseService,
): void {
  server.registerTool(
    "analyze-kickbase-player-value",
    {
      title: "Analyze a Kickbase player's fair value and buy/sell price",
      description:
        "Estimates a fair value for a player based on their current market value and 7-day " +
        "value trend, and states up to what price a buy is reasonable (or from what price a " +
        "sell is). Pass consideredPrice to get an explicit BUY / TOO EXPENSIVE verdict for a " +
        "specific price, e.g. one seen on the market. This is a transparent heuristic based " +
        "on market-value momentum only, not a guarantee — see the tool output for the exact " +
        "trend and adjustment used.",
      inputSchema: { playerId: z.string(), consideredPrice: z.number().positive().optional() },
    },
    async ({ playerId, consideredPrice }) =>
      createTextResponse(await kickbaseService.getPlayerValueAnalysis(playerId, consideredPrice)),
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
 * Read-only matchup analysis sourced from OpenLigaDB (a free, publicly
 * documented football data API), not Kickbase's own API. teamName is
 * matched loosely (e.g. "Bayern", "Dortmund") — the tool description tells
 * the caller to pass whatever club name/short name it already knows for
 * the player in question.
 */
export function registerAnalyzeTeamMatchupTool(server: McpServer, matchupService: MatchupService): void {
  server.registerTool(
    "analyze-kickbase-team-matchup",
    {
      title: "Analyze a Bundesliga club's form and fixture congestion",
      description:
        "Reports a club's recent form (last 5 results), upcoming Bundesliga fixtures, and " +
        "whether it faces fixture congestion (2+ or 3+ matches within 7 days across the " +
        "Bundesliga, DFB-Pokal, and European competitions) - useful for judging rotation/injury " +
        "risk for a player from that club. Pass the club's common name or short name, e.g. " +
        "\"Bayern\", \"Dortmund\", \"Leverkusen\". Sourced from OpenLigaDB, not Kickbase's API.",
      inputSchema: { teamName: z.string() },
    },
    async ({ teamName }) => createTextResponse(await matchupService.getTeamMatchupAnalysis(teamName)),
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
