import type { BaseXiClient } from "@kickbase-ai-manager/basexi";

/**
 * Formats BaseXI's real (but unofficial, opt-in — see CLAUDE.md) Kickbase data
 * mirror into the plain-text shape the MCP tool returns. See
 * packages/basexi/src/client.ts for the opt-in gating this depends on.
 */
export class BaseXiService {
  constructor(private readonly client: BaseXiClient) {}

  async getPlayerSnapshot(name: string): Promise<string> {
    const player = await this.client.findPlayer(name);
    if (!player) {
      return `No BaseXI entry found matching "${name}".`;
    }

    const lines = [
      `${player.name} (${player.position}, ${player.teamName})`,
      `Market value: ${player.marketValue} (${player.mvTrend >= 0 ? "+" : ""}${player.mvTrend} last change)`,
      `Points this season: ${player.totalPoints} (avg ${player.avgPoints}) — previous season: ` +
        `${player.totalPrevSeason} (avg ${player.avgPrevSeason})`,
      `Status: ${player.statusText ?? `code ${player.status}`}${player.isHot ? " — trending hot" : ""}`,
    ];

    if (player.match_data) {
      lines.push(
        `Next match: ${player.match_data.home_game ? "vs" : "at"} ${player.match_data.next_opponent}` +
          (player.match_data.odds && player.match_data.odds !== "- | - | -"
            ? ` (odds home|draw|away: ${player.match_data.odds})`
            : ""),
      );
    }

    lines.push(
      "Source: base-xi.de, an unofficial community mirror of Kickbase data — not Kickbase itself, " +
        "and only queried because you explicitly enabled this integration.",
    );

    return lines.join("\n");
  }
}
