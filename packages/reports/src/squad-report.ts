import type { AttentionEntry, DecliningPlayerEntry } from "@kickbase-ai-manager/analytics";
import { buildLigaInsiderSearchQuery } from "@kickbase-ai-manager/shared";

export interface SquadReportInput {
  /** The already-formatted output of KickbaseService.getSquadValuation(), reused as-is. */
  valuationSummaryText: string;
  decliningPlayers: DecliningPlayerEntry[];
  playersNeedingAttention: AttentionEntry[];
}

/**
 * Builds a squad report: the valuation summary plus a Recommendations
 * section that turns the declining-value and attention-status lists into
 * concrete next actions, including a LigaInsider search for each flagged
 * player so current news (injuries, lineup) can be factored in. Does not
 * itself decide anything — every recommendation is "go check X", not "sell
 * player Y", consistent with this project's no-invented-data rule.
 */
export function buildSquadReport(input: SquadReportInput): string {
  const recommendations = buildRecommendations(input.decliningPlayers, input.playersNeedingAttention);

  if (recommendations.length === 0) {
    return `${input.valuationSummaryText}\n\nRecommendations: none — no declining or flagged players found.`;
  }

  return `${input.valuationSummaryText}\n\nRecommendations:\n${recommendations.join("\n")}`;
}

function buildRecommendations(
  decliningPlayers: DecliningPlayerEntry[],
  playersNeedingAttention: AttentionEntry[],
): string[] {
  const recommendations: string[] = [];

  for (const player of decliningPlayers) {
    recommendations.push(
      `- ${player.name} has lost ${Math.abs(player.marketValueGainLoss)} in value since acquisition. ` +
        `Check its fair value (analyze-kickbase-player-value) and search ` +
        `"${buildLigaInsiderSearchQuery(player.name)}" for why before deciding whether to hold or sell.`,
    );
  }

  for (const player of playersNeedingAttention) {
    recommendations.push(
      `- ${player.name} has a non-default status code (status=${player.status}, ` +
        `matchdayStatus=${player.matchdayStatus}; exact meaning not confirmed for this API). Search ` +
        `"${buildLigaInsiderSearchQuery(player.name)}" to see what's going on before matchday.`,
    );
  }

  return recommendations;
}
