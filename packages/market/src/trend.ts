export interface MarketValueTrends {
  /** Value change over the most recent tracked day, in currency units. */
  oneDayTrend: number;
  /** Value change over the most recent 7 tracked days, in currency units. */
  sevenDayTrend: number;
}

/**
 * Computes 1-day and 7-day trends from a chronological (oldest-first) series
 * of market values. Returns zeros if fewer than 2 data points are available
 * rather than guessing.
 */
export function computeMarketValueTrends(chronologicalValues: number[]): MarketValueTrends {
  const entries = chronologicalValues.slice(-7);
  if (entries.length < 2) {
    return { oneDayTrend: 0, sevenDayTrend: 0 };
  }

  const last = entries[entries.length - 1];
  const secondToLast = entries[entries.length - 2];
  const first = entries[0];
  if (last === undefined || secondToLast === undefined || first === undefined) {
    return { oneDayTrend: 0, sevenDayTrend: 0 };
  }

  return {
    oneDayTrend: last - secondToLast,
    sevenDayTrend: last - first,
  };
}
