import type { ImpliedProbabilities, KickbasePosition, TeamHomeAwaySplit, TeamStrengthInput } from "./types.js";

/**
 * Every constant below is a disclosed, fixed modeling assumption, not a
 * measured fact — same spirit as packages/market/src/fair-value.ts's
 * TREND_CARRYOVER/MAX_ADJUSTMENT_PCT. Each one is surfaced in the returned
 * rationale so a caller can judge whether to trust the result, per this
 * project's rule against presenting derived numbers as verified facts.
 */
const GENERIC_HOME_ADVANTAGE_PCT = 0.03;
/** Need at least this many home AND away matches this season before trusting a team's own measured split over the generic assumption. */
const MIN_HOME_AWAY_SAMPLE = 3;
/** Percentage-point adjustment per 1.0 points-per-game of measured home/away split. */
const TEAM_SPECIFIC_HOME_AWAY_SCALE = 0.1;
const TEAM_SPECIFIC_HOME_AWAY_CAP = 0.1;
const WIN_PROBABILITY_BASELINE = 1 / 3;
const WIN_PROBABILITY_WEIGHT = 0.3;
const CLEAN_SHEET_RATE_BASELINE = 0.3;
const CLEAN_SHEET_WEIGHT = 0.4;
const GOALS_PER_MATCH_BASELINE = 1.5;
const OWN_GOALS_WEIGHT = 0.2;
const OPPONENT_WEAKNESS_WEIGHT = 0.2;
const MAX_ADJUSTMENT_PCT = 0.25;

export interface MatchupAdjustmentInput {
  position: KickbasePosition;
  isHome?: boolean;
  /** The player's team's own measured home/away split this season — see homeAwayComponent. */
  ownTeamHomeAwaySplit?: TeamHomeAwaySplit;
  ownTeam?: TeamStrengthInput;
  opponentTeam?: TeamStrengthInput;
  impliedProbabilities?: ImpliedProbabilities;
}

export interface MatchupAdjustment {
  adjustmentPct: number;
  rationale: string[];
}

/**
 * Combines home/away, implied win probability, and team goal/clean-sheet
 * form into a single capped +/- adjustment. Goalkeepers/defenders are judged
 * on clean-sheet suitability (own defensive record + opponent's attacking
 * weakness); midfielders/forwards on scoring suitability (own attacking
 * record + opponent's defensive weakness). Any component whose input is
 * missing (typically: pre-season, no matches played yet) is simply skipped
 * rather than guessed — see the rationale for exactly what was and wasn't
 * available.
 */
export function computeMatchupAdjustment(input: MatchupAdjustmentInput): MatchupAdjustment {
  let adjustment = 0;
  const rationale: string[] = [];
  const isDefensive = input.position === "Torwart" || input.position === "Abwehr";

  if (input.isHome !== undefined) {
    const { delta, note } = homeAwayComponent(input.isHome, input.ownTeamHomeAwaySplit);
    adjustment += delta;
    rationale.push(note);
  }

  if (input.impliedProbabilities) {
    const delta = (input.impliedProbabilities.win - WIN_PROBABILITY_BASELINE) * WIN_PROBABILITY_WEIGHT;
    adjustment += delta;
    rationale.push(
      `Implied win probability from posted odds: ${formatPct1(input.impliedProbabilities.win)} ` +
        `(vs. ${formatPct1(WIN_PROBABILITY_BASELINE)} baseline): ${formatPct(delta)}.`,
    );
  }

  if (input.ownTeam && input.ownTeam.matchesConsidered > 0) {
    const { delta, note } = isDefensive
      ? ownCleanSheetComponent(input.ownTeam)
      : ownAttackComponent(input.ownTeam);
    adjustment += delta;
    rationale.push(note);
  }

  if (input.opponentTeam && input.opponentTeam.matchesConsidered > 0) {
    const { delta, note } = isDefensive
      ? opponentAttackWeaknessComponent(input.opponentTeam)
      : opponentDefenseWeaknessComponent(input.opponentTeam);
    adjustment += delta;
    rationale.push(note);
  }

  if (rationale.length === 0) {
    rationale.push("No matchup data available yet (likely pre-season) — adjustment left at 0%.");
  }

  const capped = clamp(adjustment, -MAX_ADJUSTMENT_PCT, MAX_ADJUSTMENT_PCT);
  if (capped !== adjustment) {
    rationale.push(`Combined adjustment capped at ${formatPct(capped)} (raw total was ${formatPct(adjustment)}).`);
  }

  return { adjustmentPct: capped, rationale };
}

/**
 * Uses the team's own measured home/away points-per-game split this season
 * once both sides have at least MIN_HOME_AWAY_SAMPLE matches — a real,
 * team-specific signal ("this team is much stronger at home") instead of
 * assuming every team benefits from home advantage equally. Falls back to a
 * generic flat assumption early in the season, before there's enough data
 * to trust the team's own split.
 */
function homeAwayComponent(isHome: boolean, split: TeamHomeAwaySplit | undefined): { delta: number; note: string } {
  if (split && split.home.matchesConsidered >= MIN_HOME_AWAY_SAMPLE && split.away.matchesConsidered >= MIN_HOME_AWAY_SAMPLE) {
    const raw = (isHome ? 1 : -1) * split.homeAdvantageDelta * TEAM_SPECIFIC_HOME_AWAY_SCALE;
    const delta = clamp(raw, -TEAM_SPECIFIC_HOME_AWAY_CAP, TEAM_SPECIFIC_HOME_AWAY_CAP);
    return {
      delta,
      note:
        `${split.teamName}'s measured split this season: ${split.home.pointsPerGame.toFixed(2)} pts/game home vs ` +
        `${split.away.pointsPerGame.toFixed(2)} pts/game away (delta ${formatSigned(split.homeAdvantageDelta)}) — ` +
        `${isHome ? "home" : "away"} fixture: ${formatPct(delta)}.`,
    };
  }

  const delta = isHome ? GENERIC_HOME_ADVANTAGE_PCT : -GENERIC_HOME_ADVANTAGE_PCT;
  return {
    delta,
    note:
      `${isHome ? "Home" : "Away"} fixture: ${formatPct(delta)} (generic assumption — not enough home/away ` +
      "matches yet this season to use this team's own measured split).",
  };
}

function ownCleanSheetComponent(team: TeamStrengthInput): { delta: number; note: string } {
  const rate = team.cleanSheets / team.matchesConsidered;
  const delta = (rate - CLEAN_SHEET_RATE_BASELINE) * CLEAN_SHEET_WEIGHT;
  return {
    delta,
    note:
      `${team.teamName}'s recent clean-sheet rate: ${formatPct1(rate)} over ${team.matchesConsidered} matches ` +
      `(vs. ${formatPct1(CLEAN_SHEET_RATE_BASELINE)} baseline): ${formatPct(delta)}.`,
  };
}

function ownAttackComponent(team: TeamStrengthInput): { delta: number; note: string } {
  const goalsForPerMatch = team.goalsFor / team.matchesConsidered;
  const delta = ((goalsForPerMatch - GOALS_PER_MATCH_BASELINE) / GOALS_PER_MATCH_BASELINE) * OWN_GOALS_WEIGHT;
  return {
    delta,
    note:
      `${team.teamName}'s recent scoring rate: ${goalsForPerMatch.toFixed(2)} goals/match over ` +
      `${team.matchesConsidered} matches (vs. ${GOALS_PER_MATCH_BASELINE} baseline): ${formatPct(delta)}.`,
  };
}

function opponentAttackWeaknessComponent(opponent: TeamStrengthInput): { delta: number; note: string } {
  const goalsForPerMatch = opponent.goalsFor / opponent.matchesConsidered;
  const delta =
    ((GOALS_PER_MATCH_BASELINE - goalsForPerMatch) / GOALS_PER_MATCH_BASELINE) * OPPONENT_WEAKNESS_WEIGHT;
  return {
    delta,
    note:
      `${opponent.teamName}'s recent scoring rate: ${goalsForPerMatch.toFixed(2)} goals/match ` +
      `(a weaker opponent attack helps a clean sheet): ${formatPct(delta)}.`,
  };
}

function opponentDefenseWeaknessComponent(opponent: TeamStrengthInput): { delta: number; note: string } {
  const goalsAgainstPerMatch = opponent.goalsAgainst / opponent.matchesConsidered;
  const delta =
    ((goalsAgainstPerMatch - GOALS_PER_MATCH_BASELINE) / GOALS_PER_MATCH_BASELINE) * OPPONENT_WEAKNESS_WEIGHT;
  return {
    delta,
    note:
      `${opponent.teamName}'s recent goals conceded: ${goalsAgainstPerMatch.toFixed(2)}/match ` +
      `(a weaker opponent defense helps attacking output): ${formatPct(delta)}.`,
  };
}

function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatPct1(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
