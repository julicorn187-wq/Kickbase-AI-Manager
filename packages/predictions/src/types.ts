/**
 * Minimal, source-agnostic input shapes this package needs. Deliberately not
 * importing @kickbase-ai-manager/basexi's or fixtures' wire/domain types, so
 * this package's scoring logic is testable without a dependency on either —
 * same pattern as packages/analytics/src/squad-valuation.ts.
 */

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
  isHome?: boolean;
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
  /** The capped, disclosed matchup adjustment applied to averagePoints — see computeMatchupAdjustment. */
  adjustmentPct: number;
  /**
   * Ranking score = averagePoints * (1 + adjustmentPct). This is NOT a points
   * prediction or a probability — it's an ordinal ranking aid, useful only to
   * compare players against each other under the same disclosed formula.
   */
  compositeScore: number;
  /** Plain-language explanation of every input that fed adjustmentPct, in order. */
  rationale: string[];
  baseXiMomentum?: string;
  baseXiNextMatchDifficulty?: number;
}
