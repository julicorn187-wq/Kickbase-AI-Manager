import { describe, expect, it } from "vitest";
import { applyShrinkage } from "./shrinkage.js";

describe("applyShrinkage", () => {
  it("weights the raw sample and baseline equally at the credibility threshold", () => {
    const result = applyShrinkage(100, 10, 50, 10);
    expect(result.weightOnSample).toBeCloseTo(0.5, 5);
    expect(result.shrunkAveragePoints).toBeCloseTo(75, 5);
  });

  it("pulls a tiny sample heavily toward the baseline", () => {
    const result = applyShrinkage(200, 1, 50, 10);
    expect(result.weightOnSample).toBeCloseTo(1 / 11, 5);
    expect(result.shrunkAveragePoints).toBeLessThan(100);
    expect(result.shrunkAveragePoints).toBeGreaterThan(50);
  });

  it("barely moves a large sample away from its raw average", () => {
    const result = applyShrinkage(100, 1000, 50, 10);
    expect(result.weightOnSample).toBeGreaterThan(0.99);
    expect(result.shrunkAveragePoints).toBeCloseTo(100, 0);
  });

  it("returns exactly the baseline when there are zero games considered", () => {
    const result = applyShrinkage(999, 0, 42, 10);
    expect(result.weightOnSample).toBe(0);
    expect(result.shrunkAveragePoints).toBe(42);
  });

  it("returns the raw average unchanged when it already equals the baseline", () => {
    const result = applyShrinkage(75, 3, 75, 10);
    expect(result.shrunkAveragePoints).toBeCloseTo(75, 5);
  });
});
