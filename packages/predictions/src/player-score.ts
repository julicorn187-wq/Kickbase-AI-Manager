import { computeDifferentiationHint } from "./differentiation.js";
import { computeMatchupAdjustment } from "./matchup-adjustment.js";
import { applyShrinkage } from "./shrinkage.js";
import type { PlayerScoreInput, PlayerValueScore } from "./types.js";

/** Below this weight-on-sample, shrinkage moved the number enough to be worth a rationale line. */
const SHRINKAGE_NOTE_THRESHOLD = 0.9;

/**
 * Scores a player for matchday-ranking purposes: compositeScore =
 * (shrunkAveragePoints ?? averagePoints) * (1 + adjustmentPct). This is an
 * ordinal ranking aid, not a points prediction or a probability of anything —
 * see computeMatchupAdjustment for what adjustmentPct is built from,
 * applyShrinkage for the small-sample correction, and rationale for the
 * plain-language breakdown of every piece.
 */
export function computePlayerValueScore(input: PlayerScoreInput): PlayerValueScore {
  const { adjustmentPct, rationale: matchupRationale } = computeMatchupAdjustment(input);

  const positionBaseline = input.positionBaseline;
  const shrinkage =
    positionBaseline !== undefined
      ? applyShrinkage(input.averagePoints, input.gamesConsidered, positionBaseline)
      : undefined;
  const scoringAverage = shrinkage?.shrunkAveragePoints ?? input.averagePoints;
  const compositeScore = scoringAverage * (1 + adjustmentPct);

  const baseNote =
    `${input.averagePointsSource === "current-season" ? "Current-season" : "Previous-season"} average: ` +
    `${input.averagePoints.toFixed(1)} pts over ${input.gamesConsidered} matches` +
    (input.averagePointsSource === "previous-season" ? " (this season hasn't provided enough data yet)." : ".");

  const shrinkageNote =
    shrinkage && shrinkage.weightOnSample < SHRINKAGE_NOTE_THRESHOLD && positionBaseline !== undefined
      ? [
          `Small sample (${input.gamesConsidered} matches) — shrunk toward the ${input.position} baseline ` +
            `(${positionBaseline.toFixed(1)} pts) for scoring: ${input.averagePoints.toFixed(1)} -> ` +
            `${scoringAverage.toFixed(1)} pts (credibility-weighted shrinkage, sample weight ` +
            `${(shrinkage.weightOnSample * 100).toFixed(0)}%).`,
        ]
      : [];

  const differentiation =
    input.positionAverageMarketValue !== undefined
      ? computeDifferentiationHint(input.marketValue, input.positionAverageMarketValue)
      : undefined;

  return {
    id: input.id,
    name: input.name,
    position: input.position,
    teamName: input.teamName,
    marketValue: input.marketValue,
    averagePoints: input.averagePoints,
    averagePointsSource: input.averagePointsSource,
    gamesConsidered: input.gamesConsidered,
    ...(shrinkage !== undefined && { shrunkAveragePoints: shrinkage.shrunkAveragePoints }),
    adjustmentPct,
    compositeScore,
    rationale: [baseNote, ...shrinkageNote, ...matchupRationale],
    ...(input.baseXiMomentum !== undefined && { baseXiMomentum: input.baseXiMomentum }),
    ...(input.baseXiNextMatchDifficulty !== undefined && {
      baseXiNextMatchDifficulty: input.baseXiNextMatchDifficulty,
    }),
    ...(differentiation !== undefined && { differentiation }),
  };
}
