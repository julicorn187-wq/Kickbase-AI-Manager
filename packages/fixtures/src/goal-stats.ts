import type { TeamMatchInput } from "./types.js";

export interface GoalStats {
  matchesConsidered: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  /** Matches in which this team conceded zero goals. */
  cleanSheets: number;
}

/**
 * Tallies goals for/against and clean sheets across a team's last `count`
 * finished matches with recorded scores, most recent first. Matches without
 * both goalsFor and goalsAgainst recorded are ignored rather than guessed —
 * mirrors computeFormCurve's treatment of missing results.
 */
export function computeGoalStats(matches: TeamMatchInput[], count = 5): GoalStats {
  const considered = matches
    .filter(
      (m): m is TeamMatchInput & { goalsFor: number; goalsAgainst: number } =>
        m.isFinished && m.goalsFor !== undefined && m.goalsAgainst !== undefined,
    )
    .sort((a, b) => new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime())
    .slice(0, count);

  const goalsFor = considered.reduce((total, m) => total + m.goalsFor, 0);
  const goalsAgainst = considered.reduce((total, m) => total + m.goalsAgainst, 0);

  return {
    matchesConsidered: considered.length,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    cleanSheets: considered.filter((m) => m.goalsAgainst === 0).length,
  };
}
