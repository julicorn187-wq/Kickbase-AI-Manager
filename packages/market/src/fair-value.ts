/** How much of the observed 7-day trend we project forward, as a fraction. */
const TREND_CARRYOVER = 0.5;

/** Caps the fair-value adjustment at +/- this fraction of the current market value. */
const MAX_ADJUSTMENT_PCT = 0.15;

export interface FairValueEstimate {
  currentMarketValue: number;
  /** The estimated fair value: currentMarketValue adjusted by adjustmentPct. */
  fairValue: number;
  /** The raw 7-day trend expressed as a fraction of currentMarketValue, before damping/capping. */
  sevenDayTrendPct: number;
  /** The damped, capped adjustment actually applied to currentMarketValue. */
  adjustmentPct: number;
}

/**
 * A deliberately simple, transparent fair-value estimate for a player.
 *
 * Kickbase's own current market value already reacts to recent performance,
 * so this does not re-derive value from scratch. It nudges the current
 * market value by a damped, capped fraction of the observed 7-day trend, on
 * the assumption that a recent trend is more likely than not to partially
 * continue in the short term. This is a heuristic, not a prediction model —
 * every input and the resulting adjustment is returned so a caller can
 * judge for themselves whether to trust it, per this project's rule against
 * presenting derived numbers as if they were verified facts.
 *
 * Deliberately does not yet factor in recent point performance separately
 * from market value trend — see PLAN.md for that as a follow-up increment,
 * to avoid combining two heterogeneous signals behind an unexplained weight.
 */
export function estimateFairValue(currentMarketValue: number, sevenDayTrend: number): FairValueEstimate {
  if (currentMarketValue <= 0) {
    return { currentMarketValue, fairValue: currentMarketValue, sevenDayTrendPct: 0, adjustmentPct: 0 };
  }

  const sevenDayTrendPct = sevenDayTrend / currentMarketValue;
  const adjustmentPct = clamp(sevenDayTrendPct * TREND_CARRYOVER, -MAX_ADJUSTMENT_PCT, MAX_ADJUSTMENT_PCT);
  const fairValue = Math.round(currentMarketValue * (1 + adjustmentPct));

  return { currentMarketValue, fairValue, sevenDayTrendPct, adjustmentPct };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
