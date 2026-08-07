import { describe, expect, it } from "vitest";
import { computeMarketValueTrends } from "./trend.js";

describe("computeMarketValueTrends", () => {
  it("returns zeros when fewer than 2 data points are given", () => {
    expect(computeMarketValueTrends([])).toEqual({ oneDayTrend: 0, sevenDayTrend: 0 });
    expect(computeMarketValueTrends([100])).toEqual({ oneDayTrend: 0, sevenDayTrend: 0 });
  });

  it("computes 1-day trend as the change from the second-to-last to the last value", () => {
    const { oneDayTrend } = computeMarketValueTrends([100, 110, 130]);
    expect(oneDayTrend).toBe(20);
  });

  it("computes 7-day trend as the change from the first to the last of up to 7 values", () => {
    const { sevenDayTrend } = computeMarketValueTrends([100, 110, 130]);
    expect(sevenDayTrend).toBe(30);
  });

  it("only considers the most recent 7 values for the 7-day trend", () => {
    // 8 values; the oldest (0) must be dropped, so the 7-day trend is measured from index 1 (100).
    const { sevenDayTrend } = computeMarketValueTrends([0, 100, 100, 100, 100, 100, 100, 150]);
    expect(sevenDayTrend).toBe(50);
  });

  it("handles a declining trend", () => {
    const trends = computeMarketValueTrends([200, 180, 150]);
    expect(trends.oneDayTrend).toBe(-30);
    expect(trends.sevenDayTrend).toBe(-50);
  });
});
