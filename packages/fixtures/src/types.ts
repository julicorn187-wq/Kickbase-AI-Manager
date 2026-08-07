/**
 * Minimal, source-agnostic shape this package needs for one team's match.
 * Deliberately not importing OpenLigaDB's wire types, so this package's
 * logic is testable without a dependency on that API client.
 */
export interface TeamMatchInput {
  opponentName: string;
  /** ISO 8601 kickoff time. */
  kickoffUtc: string;
  isHome: boolean;
  /** Free-text competition label, e.g. "Bundesliga", "DFB-Pokal". */
  competition: string;
  isFinished: boolean;
  /** Only meaningful when isFinished is true. */
  result?: "W" | "D" | "L";
  /** Goals scored by this team. Only meaningful when isFinished is true. */
  goalsFor?: number;
  /** Goals conceded by this team. Only meaningful when isFinished is true. */
  goalsAgainst?: number;
}
