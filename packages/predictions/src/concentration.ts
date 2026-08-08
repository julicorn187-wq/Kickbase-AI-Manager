import type { PlayerValueScore } from "./types.js";

/**
 * More than this many starters from one club is flagged as concentrated,
 * correlated risk — portfolio-construction logic borrowed from quant
 * finance: a single adverse event (a bad result, a red card, a postponed
 * match) then swings multiple of your 11 picks at once instead of just one.
 * Shared by buildValueLineup and buildBudgetConstrainedLineup — a real
 * backtest (see PLAN.md) showed the budget-constrained builder piling 5 of
 * 11 starters onto one club, since every player from a team with a
 * favorable matchup gets a correlated score boost from the same
 * team-level signals.
 */
const MAX_RECOMMENDED_PER_TEAM = 2;

export function computeConcentrationWarnings(starters: PlayerValueScore[]): string[] {
  const countsByTeam = new Map<string, number>();
  for (const player of starters) {
    countsByTeam.set(player.teamName, (countsByTeam.get(player.teamName) ?? 0) + 1);
  }

  return [...countsByTeam.entries()]
    .filter(([, count]) => count > MAX_RECOMMENDED_PER_TEAM)
    .map(
      ([teamName, count]) =>
        `${count} starters from ${teamName} — correlated risk: one bad result for that club would hit ` +
        `${count} of your 11 picks at once. Consider diversifying.`,
    );
}
