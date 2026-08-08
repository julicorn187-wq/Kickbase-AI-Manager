/**
 * Minimal, source-agnostic input shapes this package needs. Deliberately not
 * importing @kickbase-ai-manager/basexi's or fixtures' wire/domain types, so
 * this package's scoring logic is testable without a dependency on either —
 * same pattern as packages/analytics/src/squad-valuation.ts.
 */
import type { DifferentiationHint } from "./differentiation.js";

export type KickbasePosition = "Torwart" | "Abwehr" | "Mittelfeld" | "Sturm";

export interface ImpliedProbabilities {
  win: number;
  draw: number;
  loss: number;
}

/** A team's recent record, as computed by @kickbase-ai-manager/fixtures. */
export interface TeamStrengthInput {
  teamName: string;
  matchesConsidered: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
}

/** One side (home or away) of a team's season-long split — mirrors fixtures' SplitRecord. */
export interface SplitRecord {
  matchesConsidered: number;
  wins: number;
  draws: number;
  losses: number;
  pointsPerGame: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  cleanSheets: number;
}

/**
 * A team's home vs away record across the whole season, as computed by
 * @kickbase-ai-manager/fixtures' computeHomeAwaySplit — used to measure an
 * actual, team-specific home-field advantage (or away strength) instead of
 * assuming every team benefits from home advantage equally.
 */
export interface TeamHomeAwaySplit {
  teamName: string;
  home: SplitRecord;
  away: SplitRecord;
  /** home.pointsPerGame - away.pointsPerGame. Positive: stronger at home. Negative: stronger away. */
  homeAdvantageDelta: number;
}

export interface PlayerScoreInput {
  id: string;
  name: string;
  position: KickbasePosition;
  teamName: string;
  marketValue: number;
  /** The current- or previous-season average points figure being used — see averagePointsSource. */
  averagePoints: number;
  /** Which season averagePoints is drawn from, so a caller can disclose it rather than imply it's current form. */
  averagePointsSource: "current-season" | "previous-season";
  /** Matches the averagePoints figure is actually averaged over — low counts deserve a confidence caveat. */
  gamesConsidered: number;
  /**
   * Average points across all eligible players at the same position, from
   * the same season source as this player's averagePoints. When supplied,
   * used as a shrinkage prior (see applyShrinkage/shrinkage.ts) so a tiny
   * sample (e.g. 2 games) doesn't produce an overconfident score — the same
   * "don't trust a noisy small-sample estimate at face value" logic quant
   * factor models use (credibility theory / empirical Bayes shrinkage).
   * Omit to skip shrinkage entirely and score the raw average as-is.
   */
  positionBaseline?: number;
  /**
   * Average marketValue across all eligible players at the same position.
   * When supplied, used to compute a differentiation hint (see
   * differentiation.ts) — surfaced separately from compositeScore, never
   * folded into it, since it's a proxy for ownership, not a measured fact.
   */
  positionAverageMarketValue?: number;
  isHome?: boolean;
  /**
   * The player's team's own measured home/away split this season. When both
   * sides have enough matches (see computeMatchupAdjustment), the home/away
   * component of the adjustment uses this team-specific split instead of a
   * generic flat assumption. Omit to always use the generic assumption.
   */
  ownTeamHomeAwaySplit?: TeamHomeAwaySplit;
  /** The player's team's recent record. Omit when no current-season matches have been played yet. */
  ownTeam?: TeamStrengthInput;
  /** The next opponent's recent record. Omit when no current-season matches have been played yet. */
  opponentTeam?: TeamStrengthInput;
  /** Implied win/draw/loss probability for the player's team's next match, from posted betting odds. */
  impliedProbabilities?: ImpliedProbabilities;
  /**
   * BaseXI's own signals, surfaced for context only — see BaseXiPlayer.momentum
   * and BaseXiNextMatch.difficulty. Never folded into compositeScore: their
   * scale and methodology aren't documented, so this package can't responsibly
   * assign them a weight. Included here purely so callers can print them
   * alongside the disclosed score without a second round-trip.
   */
  baseXiMomentum?: string;
  baseXiNextMatchDifficulty?: number;
}

export interface PlayerValueScore {
  id: string;
  name: string;
  position: KickbasePosition;
  teamName: string;
  marketValue: number;
  averagePoints: number;
  averagePointsSource: "current-season" | "previous-season";
  gamesConsidered: number;
  /**
   * Present only when a positionBaseline was supplied: averagePoints pulled
   * toward it in proportion to sample size (see applyShrinkage), and used
   * for compositeScore instead of the raw averagePoints above.
   */
  shrunkAveragePoints?: number;
  /** The capped, disclosed matchup adjustment applied on top of averagePoints/shrunkAveragePoints — see computeMatchupAdjustment. */
  adjustmentPct: number;
  /**
   * Ranking score = (shrunkAveragePoints ?? averagePoints) * (1 + adjustmentPct).
   * This is NOT a points prediction or a probability — it's an ordinal
   * ranking aid, useful only to compare players against each other under
   * the same disclosed formula.
   */
  compositeScore: number;
  /** Plain-language explanation of every input that fed adjustmentPct, in order. */
  rationale: string[];
  baseXiMomentum?: string;
  baseXiNextMatchDifficulty?: number;
  /** Present only when positionAverageMarketValue was supplied — see differentiation.ts. Informational only, not scored. */
  differentiation?: DifferentiationHint;
}
