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

/**
 * BaseXI's own preview of the player's next fixture. difficulty is BaseXI's
 * own rating — its scale and methodology are not documented anywhere on the
 * site, so treat it as their opinion, not a verified fact (surface it as-is,
 * don't fold it into a score as though its meaning were confirmed).
 */
export interface BaseXiNextMatch {
  date: string;
  date_iso: string;
  matchday: number;
  home_game: boolean;
  difficulty: number;
  /** Same "home | draw | away" format and pre-season caveat as BaseXiMatchData.odds. */
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
  /** Matches played this season — 0 pre-season, before which avgPoints/totalPoints are meaningless. */
  matchesPlayed: number;
  /** Matches played last season — sample-size context for avgPrevSeason. */
  gamesPrevSeason: number;
  /** Raw status code — same caveat as Kickbase's own: exact meaning per code isn't confirmed. */
  status: number;
  statusText: string | null;
  isHot: boolean;
  /**
   * BaseXI's own qualitative momentum label (observed values include
   * "dark_green"; the full value set and what feeds it — points, market
   * value, or both — are not documented). Surfaced as-is, not scored.
   */
  momentum: string;
  match_data: BaseXiMatchData | null;
  next_match: BaseXiNextMatch | null;
}
