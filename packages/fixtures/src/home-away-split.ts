import type { TeamMatchInput } from "./types.js";

export interface SplitRecord {
  matchesConsidered: number;
  wins: number;
  draws: number;
  losses: number;
  /** (3*wins + draws) / matchesConsidered — 0 when matchesConsidered is 0. */
  pointsPerGame: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  cleanSheets: number;
}

export interface HomeAwaySplit {
  home: SplitRecord;
  away: SplitRecord;
  /** home.pointsPerGame - away.pointsPerGame. Positive: plays better at home. Negative: plays better away. */
  homeAdvantageDelta: number;
}

/**
 * Splits a team's finished matches into home vs away records across the
 * WHOLE season passed in (unlike computeFormCurve/computeGoalStats, which
 * deliberately look at only the last `count` matches for recent-form
 * purposes) — the point here is a season-long signal ("this team is much
 * stronger at home"), which a short recent window would wash out or
 * over-react to. Matches without a recorded result/goals are ignored rather
 * than guessed, same as the rest of this package.
 */
export function computeHomeAwaySplit(matches: TeamMatchInput[]): HomeAwaySplit {
  const finished = matches.filter((m) => m.isFinished);
  const home = buildSplitRecord(finished.filter((m) => m.isHome));
  const away = buildSplitRecord(finished.filter((m) => !m.isHome));
  return { home, away, homeAdvantageDelta: home.pointsPerGame - away.pointsPerGame };
}

function buildSplitRecord(matches: TeamMatchInput[]): SplitRecord {
  const withResult = matches.filter((m): m is TeamMatchInput & { result: "W" | "D" | "L" } => m.result !== undefined);
  const wins = withResult.filter((m) => m.result === "W").length;
  const draws = withResult.filter((m) => m.result === "D").length;
  const losses = withResult.filter((m) => m.result === "L").length;
  const matchesConsidered = withResult.length;

  const withGoals = matches.filter(
    (m): m is TeamMatchInput & { goalsFor: number; goalsAgainst: number } =>
      m.goalsFor !== undefined && m.goalsAgainst !== undefined,
  );
  const goalsFor = withGoals.reduce((total, m) => total + m.goalsFor, 0);
  const goalsAgainst = withGoals.reduce((total, m) => total + m.goalsAgainst, 0);

  return {
    matchesConsidered,
    wins,
    draws,
    losses,
    pointsPerGame: matchesConsidered === 0 ? 0 : (3 * wins + draws) / matchesConsidered,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    cleanSheets: withGoals.filter((m) => m.goalsAgainst === 0).length,
  };
}
