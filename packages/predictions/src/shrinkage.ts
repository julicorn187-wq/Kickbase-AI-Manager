/**
 * Empirical-Bayes / credibility-weighted shrinkage — the same technique
 * quant equity factor models use to avoid overfitting a noisy small-sample
 * average (also textbook in actuarial credibility theory and baseball
 * sabermetrics: "regress a small sample toward the group mean"). A player
 * with 2 games played shouldn't be scored as confidently as one with 30 —
 * this pulls the small-sample case toward the position's baseline average
 * in proportion to how little data backs it up.
 *
 * CREDIBILITY_MATCHES is the "as if you'd already seen this many average
 * matches" prior strength — a disclosed modeling choice, not a measured
 * fact. At gamesConsidered = CREDIBILITY_MATCHES, the raw sample and the
 * baseline get equal weight; well above it, the raw sample dominates; well
 * below it, the baseline dominates.
 */
const CREDIBILITY_MATCHES = 10;

export interface ShrinkageResult {
  shrunkAveragePoints: number;
  /** 0..1 — how much weight the player's own raw average got vs. the position baseline. */
  weightOnSample: number;
}

export function applyShrinkage(
  rawAveragePoints: number,
  gamesConsidered: number,
  positionBaseline: number,
  credibilityMatches = CREDIBILITY_MATCHES,
): ShrinkageResult {
  const weightOnSample = gamesConsidered / (gamesConsidered + credibilityMatches);
  const shrunkAveragePoints = weightOnSample * rawAveragePoints + (1 - weightOnSample) * positionBaseline;
  return { shrunkAveragePoints, weightOnSample };
}
