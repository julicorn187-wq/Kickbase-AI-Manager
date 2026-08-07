/**
 * Types for OpenLigaDB (openligadb.de), a free, unofficial-but-openly-documented
 * football data API (Swagger docs at api.openligadb.de). Unlike Kickbase's
 * v4 API, these field names come from the public API's own documented
 * response shape, verified directly against a live call — not reconstructed
 * from third-party guesses.
 */

export interface OpenLigaTeam {
  teamId: number;
  teamName: string;
  /** Short display name, e.g. "Bayern" for "FC Bayern München". */
  shortName: string;
}

export interface OpenLigaMatchResult {
  resultName: string;
  pointsTeam1: number;
  pointsTeam2: number;
  resultOrderID: number;
}

export interface OpenLigaMatch {
  matchID: number;
  /** Local kickoff time, ISO 8601 without a UTC offset. */
  matchDateTime: string;
  matchDateTimeUTC: string;
  leagueShortcut: string;
  leagueSeason: number;
  group: {
    groupName: string;
    groupOrderID: number;
  };
  team1: OpenLigaTeam;
  team2: OpenLigaTeam;
  matchIsFinished: boolean;
  /** Empty until the match is played. The final score is the entry with the highest resultOrderID. */
  matchResults: OpenLigaMatchResult[];
}

export interface OpenLigaLeagueInfo {
  leagueShortcut: string;
  leagueName: string;
  leagueSeason: number;
}
