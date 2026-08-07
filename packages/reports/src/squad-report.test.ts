import { describe, expect, it } from "vitest";
import { buildSquadReport } from "./squad-report.js";

describe("buildSquadReport", () => {
  it("states there is nothing to flag when both lists are empty", () => {
    const text = buildSquadReport({
      valuationSummaryText: "Squad valuation (1 players): ...",
      decliningPlayers: [],
      playersNeedingAttention: [],
    });

    expect(text).toContain("Squad valuation (1 players)");
    expect(text).toContain("Recommendations: none");
  });

  it("recommends checking fair value and LigaInsider for declining players", () => {
    const text = buildSquadReport({
      valuationSummaryText: "Squad valuation (1 players): ...",
      decliningPlayers: [{ id: "1", name: "Falling Star", marketValueGainLoss: -75_000 }],
      playersNeedingAttention: [],
    });

    expect(text).toContain("Falling Star has lost 75000 in value");
    expect(text).toContain("analyze-kickbase-player-value");
    expect(text).toContain("site:ligainsider.de Falling Star");
  });

  it("recommends checking LigaInsider for players needing attention", () => {
    const text = buildSquadReport({
      valuationSummaryText: "Squad valuation (1 players): ...",
      decliningPlayers: [],
      playersNeedingAttention: [{ id: "2", name: "Hurt Guy", status: 1, matchdayStatus: 0 }],
    });

    expect(text).toContain("Hurt Guy has a non-default status code (status=1, matchdayStatus=0");
    expect(text).toContain("site:ligainsider.de Hurt Guy");
  });

  it("lists declining players before attention players", () => {
    const text = buildSquadReport({
      valuationSummaryText: "summary",
      decliningPlayers: [{ id: "1", name: "Declining", marketValueGainLoss: -1000 }],
      playersNeedingAttention: [{ id: "2", name: "Flagged", status: 1, matchdayStatus: 0 }],
    });

    expect(text.indexOf("Declining")).toBeLessThan(text.indexOf("Flagged"));
  });
});
