import type { ImpliedProbabilities } from "./types.js";

/**
 * Parses a "home | draw | away" decimal-odds string (BaseXI's format, e.g.
 * "2.10 | 3.40 | 3.20") into implied probabilities, removing the bookmaker's
 * overround so the three probabilities sum to 1. Returns undefined for
 * anything that isn't three valid positive decimal odds — including BaseXI's
 * own "- | - | -" placeholder for not-yet-posted odds — rather than guessing.
 */
export function parseImpliedProbabilities(odds: string): ImpliedProbabilities | undefined {
  const parts = odds.split("|").map((p) => p.trim());
  if (parts.length !== 3) return undefined;

  const decimals = parts.map(Number);
  const [homeOdds, drawOdds, awayOdds] = decimals;
  if (decimals.some((n) => !Number.isFinite(n) || n <= 1)) return undefined;
  if (homeOdds === undefined || drawOdds === undefined || awayOdds === undefined) return undefined;

  const rawWin = 1 / homeOdds;
  const rawDraw = 1 / drawOdds;
  const rawLoss = 1 / awayOdds;
  const overround = rawWin + rawDraw + rawLoss;

  return { win: rawWin / overround, draw: rawDraw / overround, loss: rawLoss / overround };
}
