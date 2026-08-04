import type { KickbaseApiClient, MarketValueData } from "@kickbase-ai-manager/kickbase-api";
import { PLAYER_POSITION } from "@kickbase-ai-manager/kickbase-api";

const DEFAULT_MARKET_LIMIT = 20;

interface MarketValueTrends {
  oneDayTrend: number;
  sevenDayTrend: number;
}

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

    const { oneDayTrend, sevenDayTrend } = this.calculateMarketValueTrends(marketValueData);

    return (
      `name: ${playerData.fn} ${playerData.ln}, team: ${playerData.tn}, ` +
      `market value: ${playerData.mv}, total points: ${playerData.tp}, ` +
      `average points: ${playerData.ap}, points last 3 games: [${pointsLastThreeGames}], ` +
      `1-day market value trend: ${oneDayTrend}, 7-day market value trend: ${sevenDayTrend}`
    );
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

  async makeOffer(playerId: string, price: number): Promise<void> {
    await this.apiClient.makeOffer(playerId, price);
  }

  private getPositionName(pos: number): string {
    return POSITION_NAMES[pos] ?? "Unknown";
  }

  private calculateMarketValueTrends(marketValueData: MarketValueData): MarketValueTrends {
    const entries = marketValueData.it.slice(-7);
    if (entries.length < 2) {
      return { oneDayTrend: 0, sevenDayTrend: 0 };
    }

    const last = entries[entries.length - 1];
    const secondToLast = entries[entries.length - 2];
    const first = entries[0];
    if (!last || !secondToLast || !first) {
      return { oneDayTrend: 0, sevenDayTrend: 0 };
    }

    return {
      oneDayTrend: last.mv - secondToLast.mv,
      sevenDayTrend: last.mv - first.mv,
    };
  }
}
