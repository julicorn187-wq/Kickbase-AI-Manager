import { computeMatchupAdjustment } from "./matchup-adjustment.js";
import type { PlayerScoreInput, PlayerValueScore } from "./types.js";

/**
 * Scores a player for matchday-ranking purposes: compositeScore =
 * averagePoints * (1 + adjustmentPct). This is an ordinal ranking aid, not a
 * points prediction or a probability of anything — see computeMatchupAdjustment
 * for exactly what adjustmentPct is built from, and rationale for the
 * plain-language breakdown of both the base average and the adjustment.
 */
export function computePlayerValueScore(input: PlayerScoreInput): PlayerValueScore {
  const { adjustmentPct, rationale } = computeMatchupAdjustment(input);
  const compositeScore = input.averagePoints * (1 + adjustmentPct);

  const baseNote =
    `${input.averagePointsSource === "current-season" ? "Current-season" : "Previous-season"} average: ` +
    `${input.averagePoints.toFixed(1)} pts over ${input.gamesConsidered} matches` +
    (input.averagePointsSource === "previous-season" ? " (this season hasn't provided enough data yet)." : ".");

  return {
    id: input.id,
    name: input.name,
    position: input.position,
    teamName: input.teamName,
    marketValue: input.marketValue,
    averagePoints: input.averagePoints,
    averagePointsSource: input.averagePointsSource,
    gamesConsidered: input.gamesConsidered,
    adjustmentPct,
    compositeScore,
    rationale: [baseNote, ...rationale],
    ...(input.baseXiMomentum !== undefined && { baseXiMomentum: input.baseXiMomentum }),
    ...(input.baseXiNextMatchDifficulty !== undefined && {
      baseXiNextMatchDifficulty: input.baseXiNextMatchDifficulty,
    }),
  };
}
