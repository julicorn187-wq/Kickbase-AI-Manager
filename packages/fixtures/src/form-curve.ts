import type { TeamMatchInput } from "./types.js";

export interface FormCurve {
  matchesConsidered: number;
  wins: number;
  draws: number;
  losses: number;
  /** Most recent result first. */
  sequence: ("W" | "D" | "L")[];
}

/**
 * Tallies a team's last `count` finished matches (any competition present
 * in the input), most recent first. Matches without a recorded result are
 * ignored rather than guessed.
 */
export function computeFormCurve(matches: TeamMatchInput[], count = 5): FormCurve {
  const sequence = matches
    .filter((m): m is TeamMatchInput & { result: "W" | "D" | "L" } => m.isFinished && m.result !== undefined)
    .sort((a, b) => new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime())
    .slice(0, count)
    .map((m) => m.result);

  return {
    matchesConsidered: sequence.length,
    wins: sequence.filter((r) => r === "W").length,
    draws: sequence.filter((r) => r === "D").length,
    losses: sequence.filter((r) => r === "L").length,
    sequence,
  };
}

/** The next `count` not-yet-played matches, soonest first. */
export function getUpcomingMatches(matches: TeamMatchInput[], count: number): TeamMatchInput[] {
  return matches
    .filter((m) => !m.isFinished)
    .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime())
    .slice(0, count);
}
