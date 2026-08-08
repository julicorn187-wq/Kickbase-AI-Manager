import { describe, expect, it } from "vitest";
import { computeDifferentiationHint } from "./differentiation.js";

describe("computeDifferentiationHint", () => {
  it("returns undefined when there is no meaningful position average to compare against", () => {
    expect(computeDifferentiationHint(1_000_000, 0)).toBeUndefined();
    expect(computeDifferentiationHint(1_000_000, -5)).toBeUndefined();
  });

  it("labels a player priced well above the position average as a template pick", () => {
    const result = computeDifferentiationHint(13_000_000, 10_000_000);
    expect(result?.label).toBe("template");
    expect(result?.priceRatio).toBeCloseTo(1.3, 5);
  });

  it("labels a player priced well below the position average as a differential pick", () => {
    const result = computeDifferentiationHint(6_000_000, 10_000_000);
    expect(result?.label).toBe("differential");
    expect(result?.priceRatio).toBeCloseTo(0.6, 5);
  });

  it("labels a player priced close to the position average as neutral", () => {
    const result = computeDifferentiationHint(10_000_000, 10_000_000);
    expect(result?.label).toBe("neutral");
  });

  it("includes the price ratio in the note for transparency", () => {
    const result = computeDifferentiationHint(20_000_000, 10_000_000);
    expect(result?.note).toContain("2.0x");
  });
});
