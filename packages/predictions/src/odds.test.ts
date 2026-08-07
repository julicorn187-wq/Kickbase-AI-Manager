import { describe, expect, it } from "vitest";
import { parseImpliedProbabilities } from "./odds.js";

describe("parseImpliedProbabilities", () => {
  it("parses valid odds and removes the bookmaker overround", () => {
    const result = parseImpliedProbabilities("2.00 | 4.00 | 4.00");
    expect(result).toBeDefined();
    // Raw implied: 0.5, 0.25, 0.25 -> overround 1.0 -> unchanged.
    expect(result?.win).toBeCloseTo(0.5, 5);
    expect(result?.draw).toBeCloseTo(0.25, 5);
    expect(result?.loss).toBeCloseTo(0.25, 5);
    expect((result?.win ?? 0) + (result?.draw ?? 0) + (result?.loss ?? 0)).toBeCloseTo(1, 5);
  });

  it("normalizes away a real overround", () => {
    const result = parseImpliedProbabilities("1.80 | 3.50 | 4.20");
    expect(result).toBeDefined();
    expect((result?.win ?? 0) + (result?.draw ?? 0) + (result?.loss ?? 0)).toBeCloseTo(1, 5);
  });

  it("returns undefined for BaseXI's not-yet-posted placeholder", () => {
    expect(parseImpliedProbabilities("- | - | -")).toBeUndefined();
  });

  it("returns undefined for malformed input", () => {
    expect(parseImpliedProbabilities("not odds")).toBeUndefined();
    expect(parseImpliedProbabilities("1.5 | 2.0")).toBeUndefined();
    expect(parseImpliedProbabilities("1.5 | 2.0 | 0")).toBeUndefined();
    expect(parseImpliedProbabilities("1.5 | 2.0 | 0.5")).toBeUndefined();
  });
});
