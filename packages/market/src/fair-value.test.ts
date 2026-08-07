import { describe, expect, it } from "vitest";
import { estimateFairValue } from "./fair-value.js";

describe("estimateFairValue", () => {
  it("returns the current value unchanged when there is no trend", () => {
    const result = estimateFairValue(1_000_000, 0);
    expect(result.fairValue).toBe(1_000_000);
    expect(result.adjustmentPct).toBe(0);
  });

  it("nudges the fair value up for a positive trend within the cap", () => {
    // +100k over 7 days on a 1,000,000 base is a +10% raw trend; damped by 0.5 -> +5%.
    const result = estimateFairValue(1_000_000, 100_000);
    expect(result.sevenDayTrendPct).toBeCloseTo(0.1);
    expect(result.adjustmentPct).toBeCloseTo(0.05);
    expect(result.fairValue).toBe(1_050_000);
  });

  it("nudges the fair value down for a negative trend within the cap", () => {
    const result = estimateFairValue(1_000_000, -100_000);
    expect(result.adjustmentPct).toBeCloseTo(-0.05);
    expect(result.fairValue).toBe(950_000);
  });

  it("caps the adjustment at +15% even for an extreme positive trend", () => {
    // +1,000,000 over 7 days on a 1,000,000 base is a +100% raw trend; damped -> +50%, then capped at +15%.
    const result = estimateFairValue(1_000_000, 1_000_000);
    expect(result.adjustmentPct).toBeCloseTo(0.15);
    expect(result.fairValue).toBe(1_150_000);
  });

  it("caps the adjustment at -15% even for an extreme negative trend", () => {
    const result = estimateFairValue(1_000_000, -1_000_000);
    expect(result.adjustmentPct).toBeCloseTo(-0.15);
    expect(result.fairValue).toBe(850_000);
  });

  it("does not divide by zero for a non-positive current market value", () => {
    const result = estimateFairValue(0, 500);
    expect(result.fairValue).toBe(0);
    expect(result.adjustmentPct).toBe(0);
    expect(result.sevenDayTrendPct).toBe(0);
  });
});
