import type { KickbaseApiClient, LeagueRankingUser } from "@kickbase-ai-manager/kickbase-api";
import { PLAYER_POSITION } from "@kickbase-ai-manager/kickbase-api";
import { evaluateSquad, type SquadValuation } from "@kickbase-ai-manager/analytics";
import { computeMarketValueTrends, estimateFairValue } from "@kickbase-ai-manager/market";
import { buildSquadReport } from "@kickbase-ai-manager/reports";
import { buildLigaInsiderSearchQuery } from "@kickbase-ai-manager/shared";

const DEFAULT_MARKET_LIMIT = 20;

const POSITION_NAMES: Record<number, string> = {
  [PLAYER_POSITION.GOALKEEPER]: "GK",
  [PLAYER_POSITION.DEFENDER]: "DEF",
  [PLAYER_POSITION.MIDFIELDER]: "MID",
  [PLAYER_POSITION.ATTACKER]: "ATT",
};

/**
 * Formats KickbaseApiClient data into the plain-text shape the MCP tools
 * return to the model. Kept thin and transport-agnostic; no invented data —
 * every value here traces back to a field on the API response.
 */
export class KickbaseService {
  constructor(private readonly apiClient: KickbaseApiClient) {}

  async getMarketPlayers(limit: number = DEFAULT_MARKET_LIMIT): Promise<string> {
    const data = await this.apiClient.getMarketPlayers();
    const sorted = [...data.it].sort((a, b) => a.exs - b.exs);

    if (sorted.length === 0) {
      return "No players are currently listed on the market.";
    }

    return sorted
      .slice(0, limit)
      .map(
        (player) =>
          `${player.fn} ${player.n} (market value: ${player.mv}, playerId: ${player.i}, ` +
          `expires in ${Math.round(player.exs / 60)} minutes)`,
      )
      .join("\n");
  }

  async getPlayerInformation(playerId: string): Promise<string> {
    const [playerData, marketValueData] = await Promise.all([
      this.apiClient.getPlayerData(playerId),
      this.apiClient.getPlayerMarketValue(playerId),
    ]);

    const pointsLastThreeGames = playerData.ph
      .slice(0, 3)
      .map((entry) => entry.p)
      .join(",");

    const { oneDayTrend, sevenDayTrend } = computeMarketValueTrends(
      marketValueData.it.map((entry) => entry.mv),
    );

    return (
      `name: ${playerData.fn} ${playerData.ln}, team: ${playerData.tn}, ` +
      `market value: ${playerData.mv}, total points: ${playerData.tp}, ` +
      `average points: ${playerData.ap}, points last 3 games: [${pointsLastThreeGames}], ` +
      `1-day market value trend: ${oneDayTrend}, 7-day market value trend: ${sevenDayTrend}`
    );
  }

  /**
   * The player's real-world club name (Kickbase's `tn` field), for handing
   * off to MatchupService without needing to know that field's exact
   * format in advance — MatchupService matches it loosely against
   * OpenLigaDB's team names.
   */
  async getPlayerTeamName(playerId: string): Promise<string> {
    const playerData = await this.apiClient.getPlayerData(playerId);
    return playerData.tn;
  }

  async getMySquad(): Promise<string> {
    const data = await this.apiClient.getMySquad();

    if (data.it.length === 0) {
      return "Your squad is currently empty.";
    }

    const squadText = data.it
      .map(
        (player) =>
          `${player.n} (${this.getPositionName(player.pos)}) - MV: ${player.mv}, ` +
          `Points: ${player.p}, Status: ${player.st}, Team ID: ${player.tid}, ` +
          `Player ID: ${player.i}`,
      )
      .join("\n");

    return `My Squad (${data.it.length} players):\n${squadText}\n\nMax players per team: ${data.mppu}`;
  }

  /**
   * Aggregates the squad into totals, a per-position breakdown, and a list
   * of players with a non-default status code. See
   * packages/analytics/src/squad-valuation.ts — status/matchdayStatus are
   * surfaced as raw codes, not interpreted as "injured" etc., because their
   * exact meaning isn't confirmed for this API.
   */
  async getSquadValuation(): Promise<string> {
    const valuation = await this.fetchSquadValuation();
    return valuation === null ? "Your squad is currently empty." : this.formatSquadValuation(valuation);
  }

  /**
   * The squad valuation plus a Recommendations section turning the
   * declining-value and attention-status lists into concrete next actions
   * (check fair value, search LigaInsider). See
   * packages/reports/src/squad-report.ts.
   */
  async getSquadReport(): Promise<string> {
    const valuation = await this.fetchSquadValuation();
    if (valuation === null) {
      return "Your squad is currently empty.";
    }

    return buildSquadReport({
      valuationSummaryText: this.formatSquadValuation(valuation),
      decliningPlayers: valuation.decliningPlayers,
      playersNeedingAttention: valuation.playersNeedingAttention,
    });
  }

  private async fetchSquadValuation(): Promise<SquadValuation | null> {
    const data = await this.apiClient.getMySquad();
    if (data.it.length === 0) {
      return null;
    }

    return evaluateSquad(
      data.it.map((player) => ({
        id: player.i,
        name: player.n,
        marketValue: player.mv,
        marketValueGainLoss: player.mvgl,
        points: player.p,
        averagePoints: player.ap,
        position: player.pos,
        status: player.st,
        matchdayStatus: player.mdst,
      })),
    );
  }

  private formatSquadValuation(valuation: SquadValuation): string {
    const lines = [
      `Squad valuation (${valuation.playerCount} players):`,
      `Total market value: ${valuation.totalMarketValue}`,
      `Total value gain/loss since acquisition: ${valuation.totalMarketValueGainLoss >= 0 ? "+" : ""}${valuation.totalMarketValueGainLoss}`,
      `Total points: ${valuation.totalPoints} (avg ${valuation.averagePointsPerPlayer.toFixed(1)} per player)`,
      "",
      "By position:",
      ...valuation.positionBreakdown.map(
        (entry) =>
          `  ${this.getPositionName(entry.position)}: ${entry.playerCount} players, ${entry.totalMarketValue} total value`,
      ),
    ];

    if (valuation.playersNeedingAttention.length > 0) {
      lines.push(
        "",
        "Players with a non-default status code (meaning not confirmed for this API — check the " +
          "Kickbase app for details):",
        ...valuation.playersNeedingAttention.map(
          (entry) => `  ${entry.name}: status=${entry.status}, matchdayStatus=${entry.matchdayStatus}`,
        ),
      );
    }

    return lines.join("\n");
  }

  async makeOffer(playerId: string, price: number): Promise<void> {
    await this.apiClient.makeOffer(playerId, price);
  }

  async getLeagueRanking(dayNumber?: number): Promise<string> {
    const data = await this.apiClient.getLeagueRanking(dayNumber);

    if (data.us.length === 0) {
      return "No ranking data available for this league.";
    }

    const isMatchday = dayNumber !== undefined;
    const rows = data.us
      .map((user) => this.toRankingRow(user, isMatchday))
      .sort((a, b) => a.placement - b.placement);

    const header = isMatchday ? `League Ranking — Matchday ${dayNumber}` : "League Ranking (Season)";
    const body = rows.map((row) => `${row.placement}. ${row.name} — ${row.points} pts`).join("\n");

    return `${header}\n${body}`;
  }

  private toRankingRow(
    user: LeagueRankingUser,
    isMatchday: boolean,
  ): { name: string; points: number; placement: number } {
    return {
      name: user.n,
      points: (isMatchday ? user.mdp : user.sp) ?? 0,
      placement: (isMatchday ? user.mdpl : user.spl) ?? Number.MAX_SAFE_INTEGER,
    };
  }

  /**
   * Estimates a fair value for a player and states, in plain text, up to
   * what price a buy is reasonable (or from what price a sell is). If
   * consideredPrice is given, adds an explicit verdict for that price.
   * See packages/market/src/fair-value.ts for the method and its caveats —
   * this is a transparent heuristic, not a guarantee.
   */
  async getPlayerValueAnalysis(playerId: string, consideredPrice?: number): Promise<string> {
    const [playerData, marketValueData] = await Promise.all([
      this.apiClient.getPlayerData(playerId),
      this.apiClient.getPlayerMarketValue(playerId),
    ]);

    const { sevenDayTrend } = computeMarketValueTrends(marketValueData.it.map((entry) => entry.mv));
    const estimate = estimateFairValue(playerData.mv, sevenDayTrend);
    const adjustmentPctText = `${estimate.adjustmentPct >= 0 ? "+" : ""}${(estimate.adjustmentPct * 100).toFixed(1)}%`;

    const lines = [
      `${playerData.fn} ${playerData.ln} (${playerData.tn})`,
      `Current market value: ${playerData.mv}`,
      `7-day market value trend: ${sevenDayTrend >= 0 ? "+" : ""}${sevenDayTrend}`,
      `Estimated fair value: ${estimate.fairValue} (${adjustmentPctText} adjustment based on the trend, capped at +/-15%)`,
      `Recommendation: a buy is reasonable up to ${estimate.fairValue}; a sell is reasonable from ${estimate.fairValue}.`,
    ];

    if (consideredPrice !== undefined) {
      const verdict = consideredPrice <= estimate.fairValue ? "BUY" : "TOO EXPENSIVE";
      lines.push(`At a price of ${consideredPrice}: ${verdict} (fair value is ${estimate.fairValue}).`);
    }

    lines.push(
      `This estimate is based on market-value momentum only — it does not know about ` +
        `injuries, lineup probability, or news. Before acting on it, search ` +
        `"${buildLigaInsiderSearchQuery(`${playerData.fn} ${playerData.ln}`)}" for current ` +
        `LigaInsider coverage and factor that in.`,
    );

    return lines.join("\n");
  }

  private getPositionName(pos: number): string {
    return POSITION_NAMES[pos] ?? "Unknown";
  }
}
