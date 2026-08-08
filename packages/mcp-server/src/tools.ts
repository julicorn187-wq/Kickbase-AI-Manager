import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BaseXiService } from "./basexi.service.js";
import type { ForecastService } from "./forecast.service.js";
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
        "trend and adjustment used. Market value updates once daily around 22:00 CET (Kickbase-" +
        "confirmed, see docs/kickbase-mechanics.md), which is what the trend is measured over.",
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
 * Convenience wrapper around analyze-kickbase-team-matchup: resolves the
 * player's real club (Kickbase's `tn` field) automatically instead of
 * requiring the caller to already know/pass a team name. Composes
 * KickbaseService and MatchupService at this registration layer rather
 * than coupling the two services to each other directly.
 */
export function registerAnalyzePlayerMatchupTool(
  server: McpServer,
  kickbaseService: KickbaseService,
  matchupService: MatchupService,
): void {
  server.registerTool(
    "analyze-kickbase-player-matchup",
    {
      title: "Analyze the club matchup for a Kickbase player",
      description:
        "Looks up the player's real club and reports its recent form, upcoming fixtures, and " +
        "fixture congestion (see analyze-kickbase-team-matchup) - use this instead of that tool " +
        "when you have a playerId but don't already know the player's club name.",
      inputSchema: { playerId: z.string() },
    },
    async ({ playerId }) => {
      const teamName = await kickbaseService.getPlayerTeamName(playerId);
      return createTextResponse(await matchupService.getTeamMatchupAnalysis(teamName));
    },
  );
}

/**
 * Opt-in only — see packages/basexi/src/client.ts. Only ever registered when
 * ENABLE_BASEXI=true; never present in the default tool set.
 */
export function registerGetBaseXiPlayerSnapshotTool(server: McpServer, baseXiService: BaseXiService): void {
  server.registerTool(
    "get-basexi-player-snapshot",
    {
      title: "Get a player's real market value and status from BaseXI (opt-in)",
      description:
        "Real current Kickbase market value, position, points, and status for a player, from " +
        "BaseXI (base-xi.de), an unofficial community mirror of Kickbase data. Only available " +
        "because you explicitly enabled it (ENABLE_BASEXI=true) - see CLAUDE.md for why this is " +
        "opt-in rather than a default data source.",
      inputSchema: { playerName: z.string() },
    },
    async ({ playerName }) => createTextResponse(await baseXiService.getPlayerSnapshot(playerName)),
  );
}

/**
 * Opt-in only, same gate as get-basexi-player-snapshot — see
 * packages/mcp-server/src/forecast.service.ts and
 * @kickbase-ai-manager/predictions for the scoring formula.
 */
export function registerForecastMatchdayValueLineupTool(server: McpServer, forecastService: ForecastService): void {
  server.registerTool(
    "forecast-kickbase-matchday-value-lineup",
    {
      title: "Forecast a value-lineup shortlist for the next Bundesliga matchday (opt-in)",
      description:
        "Combines BaseXI's real player data (points, price, next-match info) with OpenLigaDB's " +
        "Bundesliga team form/goal-difference/clean-sheet record and each team's own measured " +
        "home/away split this season (not a flat assumption - a team that's actually stronger " +
        "away gets an away boost, not a home one) into a value-lineup shortlist: a suggested " +
        "value-XI, bench options, and a top-N-per-position list, each with a fully " +
        "disclosed rationale (see @kickbase-ai-manager/predictions for the exact scoring " +
        "formula and its weights). Caps the suggested XI at 3 candidates per club (an 18-matchday " +
        "real backtest across the 2025/26 season found this the best balance of output vs. " +
        "correlated risk - see PLAN.md) - the top-N shortlist further down stays uncapped. Flags " +
        "starters with a non-default BaseXI status (possible " +
        "injury/suspension/doubt) and fixture-congestion risk (Bundesliga + cup double/triple " +
        "gameweeks) separately, since playing-time certainty matters more than any stat - a " +
        "brilliant player on the bench scores zero. This is a ranking aid, not a points " +
        "prediction or a guaranteed lineup - it has no knowledge of your actual squad, budget, " +
        "or confirmed starting lineups (the output reminds you to search LigaInsider for that). " +
        "Before the season's first matchday, every player falls back to last season's averages and the " +
        "output says so explicitly. Only available because you explicitly enabled BaseXI " +
        "(ENABLE_BASEXI=true).",
      inputSchema: { topPerPosition: z.number().int().positive().max(20).optional() },
    },
    async ({ topPerPosition }) =>
      createTextResponse(await forecastService.getMatchdayValueLineup(topPerPosition)),
  );
}

/**
 * Opt-in only, same gate as forecast-kickbase-matchday-value-lineup — the
 * concrete "learn what works" mechanism: every forecast call logs a
 * snapshot (packages/mcp-server/src/forecast-log.ts); this diffs a past
 * snapshot's players against their current BaseXI totals once that
 * matchday has actually been played, and reports how the suggested picks
 * did. Never auto-adjusts the scoring formula - any real change to
 * @kickbase-ai-manager/predictions is a reviewed code change, not silent
 * drift from this report.
 */
export function registerReviewForecastAccuracyTool(server: McpServer, forecastService: ForecastService): void {
  server.registerTool(
    "review-kickbase-forecast-accuracy",
    {
      title: "Review how past matchday forecasts actually did (opt-in)",
      description:
        "Diffs every previously logged forecast-kickbase-matchday-value-lineup prediction whose " +
        "matchday has since been played against real BaseXI point totals, and reports per-position " +
        "hit rate (were the suggested starters actually among the top scorers at their position?) " +
        "plus every player's actual points. Nothing is invented: a player is skipped with a stated " +
        "reason if the matchday hasn't been played yet or if the diff would blend multiple " +
        "matchdays. Does not change any scoring weight itself - use the report to decide whether " +
        "@kickbase-ai-manager/predictions needs a deliberate adjustment. Only available because you " +
        "explicitly enabled BaseXI (ENABLE_BASEXI=true).",
      inputSchema: {},
    },
    async () => createTextResponse(await forecastService.getForecastAccuracyReview()),
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
            `${playerId}. To actually submit this offer, call this tool again with confirm: true. ` +
            "Note: Kickbase's transfer market sometimes rejects bids below the player's current " +
            "market value outright (see docs/kickbase-mechanics.md) — check analyze-kickbase-" +
            "player-value first if this price is a guess.",
        );
      }

      await kickbaseService.makeOffer(playerId, price);
      return createTextResponse(`Offer of ${price} for player ${playerId} was submitted successfully.`);
    },
  );
}
