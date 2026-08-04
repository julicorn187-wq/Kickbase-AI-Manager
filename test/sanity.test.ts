import { describe, expect, it } from "vitest";

describe("toolchain sanity", () => {
  it("runs Vitest against the workspace", () => {
    expect(1 + 1).toBe(2);
  });
});
