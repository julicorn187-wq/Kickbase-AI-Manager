/**
 * This project's league scoring is winner-take-all per matchday (confirmed
 * by the maintainer: only the matchday winner matters, 2nd and last are
 * equally "losers"). That's structurally a tournament/GPP format, not a
 * cash-game one — the well-established difference in daily-fantasy-sports
 * strategy: maximizing expected points is the right goal in a cash game
 * (beat a fixed line), but in a winner-take-all pool you need to separate
 * from the rest of the field, so a widely-owned "template" pick that
 * everyone else also has doesn't help you win the day even if it scores
 * well, while a less-obvious pick that beats expectations does.
 *
 * This project doesn't have real ownership data for the other 11 managers
 * in the league, so it can't measure "template-ness" directly. marketValue
 * is used as a proxy: an unusually expensive player at their position is
 * more likely to be a widely-known, widely-owned "obvious" pick (this
 * mirrors the season-long backtest finding that popular players get bid up
 * by overpay in a 12-manager league). This is a heuristic proxy, not
 * ownership data — surfaced as a separate, clearly labeled hint, never
 * folded into compositeScore, so it doesn't misrepresent a guess as a
 * measured fact.
 */
const TEMPLATE_THRESHOLD_RATIO = 1.3;
const DIFFERENTIAL_THRESHOLD_RATIO = 0.7;

export type DifferentiationLabel = "template" | "neutral" | "differential";

export interface DifferentiationHint {
  label: DifferentiationLabel;
  /** marketValue / positionAverageMarketValue. */
  priceRatio: number;
  note: string;
}

/**
 * Labels a player "template" (priced well above the position average — a
 * probable popular/widely-owned pick, so less useful for separating from
 * the field in a winner-take-all matchday), "differential" (priced well
 * below, so a good score from them is more likely to be unique), or
 * "neutral" otherwise.
 */
export function computeDifferentiationHint(
  marketValue: number,
  positionAverageMarketValue: number,
): DifferentiationHint | undefined {
  if (positionAverageMarketValue <= 0) return undefined;

  const priceRatio = marketValue / positionAverageMarketValue;

  if (priceRatio >= TEMPLATE_THRESHOLD_RATIO) {
    return {
      label: "template",
      priceRatio,
      note:
        `Priced ${priceRatio.toFixed(1)}x the position average — likely a widely-known "template" pick. ` +
        "In this league's winner-take-all format, a good score from a player everyone else also owns " +
        "doesn't separate you from the field.",
    };
  }

  if (priceRatio <= DIFFERENTIAL_THRESHOLD_RATIO) {
    return {
      label: "differential",
      priceRatio,
      note:
        `Priced ${priceRatio.toFixed(1)}x the position average — a cheaper, less obvious pick. A good ` +
        "score here is more likely to separate you from the field than the same score from a popular player.",
    };
  }

  return { label: "neutral", priceRatio, note: `Priced ${priceRatio.toFixed(1)}x the position average.` };
}
