/**
 * Domain types for the Kickbase v4 API.
 *
 * The upstream API returns short, cryptic property names (`fn`, `mv`, `tp`, ...).
 * We keep those wire names (so the client stays a thin, faithful mapping of the
 * API) but document every field here — this is the fix for upstream finding #7
 * ("cryptic partial types"). Consumers should not have to reverse-engineer the
 * Kickbase app to know what `exs` means.
 */

export interface PlayerMarketItem {
  /** First name. */
  fn: string;
  /** Last name / display name as shown on the market listing. */
  n: string;
  /** Current market value in Kickbase currency units. */
  mv: number;
  /** Player id — used to fetch details or make an offer. */
  i: string;
  /** Seconds until this market listing expires. */
  exs: number;
}

export interface PlayerPerformanceEntry {
  /** Points scored in that matchday. */
  p: number;
}

export interface PlayerData {
  /** First name. */
  fn: string;
  /** Last name. */
  ln: string;
  /** Team name the player currently plays for. */
  tn: string;
  /** Current market value. */
  mv: number;
  /** Total points accumulated this season. */
  tp: number;
  /** Average points per matchday. */
  ap: number;
  /** Performance history, most recent matchday first. */
  ph: PlayerPerformanceEntry[];
}

export interface MarketValueEntry {
  /** Market value on that day. */
  mv: number;
}

export interface MarketValueData {
  /** Chronological market value entries (oldest first). */
  it: MarketValueEntry[];
}

export interface MarketValueTrends {
  /** Market value change over the most recent day, in currency units. */
  oneDayTrend: number;
  /** Market value change over the most recent 7 tracked days, in currency units. */
  sevenDayTrend: number;
}

/** Player position codes used throughout the Kickbase API. */
export const PLAYER_POSITION = {
  GOALKEEPER: 1,
  DEFENDER: 2,
  MIDFIELDER: 3,
  ATTACKER: 4,
} as const;

export interface SquadPlayer {
  /** Average points per matchday. */
  ap: number;
  /** Player id. */
  i: string;
  /** Whether the player is currently "in form" (Kickbase in-form marker). */
  iotm: boolean;
  /** Lineup order / slot index. */
  lo: number;
  /** Last matchday status code. */
  lst: number;
  /** Current matchday status code (e.g. fit, injured, doubtful — see Kickbase app). */
  mdst: number;
  /** Current market value. */
  mv: number;
  /** Market value gain/loss since acquisition. */
  mvgl: number;
  /** Market value trend indicator (short-term direction). */
  mvt: number;
  /** Display name. */
  n: string;
  /** Number of open offers on this player. */
  ofc: number;
  /** Points this matchday/season depending on endpoint context. */
  p: number;
  /** Position code — see PLAYER_POSITION. */
  pos: number;
  /** Season-long market value trend indicator. */
  sdmvt: number;
  /** Status code. */
  st: number;
  /** Trend relative to the player's highest recorded market value. */
  tfhmvt: number;
  /** Team id the player belongs to. */
  tid: string;
}

export interface SquadData {
  /** Players currently in the squad. */
  it: SquadPlayer[];
  /** Max players allowed per real-world team in this league. */
  mppu: number;
}
