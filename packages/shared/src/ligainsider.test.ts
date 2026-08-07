import { describe, expect, it } from "vitest";
import { buildLigaInsiderSearchQuery } from "./ligainsider.js";

describe("buildLigaInsiderSearchQuery", () => {
  it("scopes the query to the ligainsider.de domain", () => {
    expect(buildLigaInsiderSearchQuery("Silas")).toBe("site:ligainsider.de Silas");
  });

  it("passes multi-word names through unchanged", () => {
    expect(buildLigaInsiderSearchQuery("Luca Jaquez")).toBe("site:ligainsider.de Luca Jaquez");
  });
});
