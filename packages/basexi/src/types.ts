/**
 * Types for BaseXI (base-xi.de), a free, unofficial third-party site that mirrors
 * real Kickbase player data (market value, position, points, status). Verified by a
 * live call during development; base-xi.de itself states its data source as the
 * Kickbase API. This is NOT an official or sanctioned integration — see the
 * "External data sources" section in CLAUDE.md before enabling it.
 *
 * Only the fields this package actually uses are modeled; the real response has
 * more (images, schedule logos, etc.) that aren't relevant here.
 */

export interface BaseXiMatchData {
  home_game: boolean;
  next_opponent: string;
  /** Betting odds as a "home | draw | away" string, e.g. "2.10 | 3.40 | 3.20". May be "- | - | -" when not yet posted (e.g. pre-season). */
  odds: string;
}

export interface BaseXiPlayer {
  id: string;
  name: string;
  /** German position label as used by Kickbase's own app: "Torwart" | "Abwehr" | "Mittelfeld" | "Sturm". */
  position: string;
  teamName: string;
  teamAbbr: string;
  marketValue: number;
  /** Most recent market value change, in currency units. */
  mvTrend: number;
  avgPoints: number;
  avgPrevSeason: number;
  totalPoints: number;
  totalPrevSeason: number;
  /** Raw status code — same caveat as Kickbase's own: exact meaning per code isn't confirmed. */
  status: number;
  statusText: string | null;
  isHot: boolean;
  matchesPlayed: number;
  match_data: BaseXiMatchData | null;
}
