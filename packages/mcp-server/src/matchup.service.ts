import type { OpenLigaDbClient, OpenLigaMatch, OpenLigaTeam } from "@kickbase-ai-manager/openligadb";
import {
  computeFixtureCongestion,
  computeFormCurve,
  getCurrentBundesligaSeasonYear,
  getUpcomingMatches,
  type TeamMatchInput,
} from "@kickbase-ai-manager/fixtures";
import { buildLigaInsiderSearchQuery } from "@kickbase-ai-manager/shared";

const RESULT_LABEL: Record<"W" | "D" | "L", string> = { W: "win", D: "draw", L: "loss" };

interface CupCompetition {
  label: string;
  namePattern: RegExp;
}

/** Competitions checked for fixture congestion alongside the Bundesliga. */
const CUP_COMPETITIONS: CupCompetition[] = [
  { label: "DFB-Pokal", namePattern: /DFB-Pokal/i },
  { label: "Champions League", namePattern: /Champions League/i },
  { label: "Europa League", namePattern: /Europa League/i },
  { label: "Conference League", namePattern: /Conference League/i },
];

/**
 * Matchup analysis sourced from OpenLigaDB (openligadb.de) — a free,
 * publicly documented football data API, unlike Kickbase's own undocumented
 * one. Deliberately a separate service from KickbaseService: this data has
 * nothing to do with the Kickbase API client or its auth.
 */
export class MatchupService {
  constructor(private readonly openLigaClient: OpenLigaDbClient) {}

  /**
   * Resolves teamName against the current Bundesliga season's fixture list
   * (case-insensitive, partial match against the full or short team name),
   * then reports recent form, the next match, the next 3 matches, and any
   * upcoming fixture congestion across the Bundesliga plus whichever cup
   * competitions can be found for the current season (best-effort — a
   * competition that can't be confidently resolved is silently skipped
   * rather than guessed, and the checked list is stated in the output).
   */
  async getTeamMatchupAnalysis(teamName: string): Promise<string> {
    const season = getCurrentBundesligaSeasonYear();
    const bundesligaMatches = await this.openLigaClient.getSeasonMatches("bl1", season);
    const team = findTeam(bundesligaMatches, teamName);

    if (!team) {
      return (
        `No Bundesliga team matching "${teamName}" was found in the ${season}/${season + 1} season. ` +
        "Try the club's common short name (e.g. \"Bayern\", \"Dortmund\", \"Leverkusen\")."
      );
    }

    const bundesligaInputs = toTeamMatchInputs(bundesligaMatches, team, "Bundesliga");
    const { matchesByCompetition, checkedCompetitions } = await fetchSeasonCupMatches(this.openLigaClient, season);
    const cupInputs = [...matchesByCompetition.entries()].flatMap(([label, matches]) =>
      toTeamMatchInputs(matches, team, label),
    );
    const allInputs = [...bundesligaInputs, ...cupInputs];

    const form = computeFormCurve(bundesligaInputs, 5);
    const nextMatches = getUpcomingMatches(bundesligaInputs, 3);
    const congestion = computeFixtureCongestion(allInputs, 7);

    return this.formatReport(team.teamName, form, nextMatches, congestion, checkedCompetitions);
  }

  private formatReport(
    teamName: string,
    form: ReturnType<typeof computeFormCurve>,
    nextMatches: TeamMatchInput[],
    congestion: ReturnType<typeof computeFixtureCongestion>,
    checkedCompetitions: string[],
  ): string {
    const lines = [`Matchup analysis for ${teamName}:`, ""];

    lines.push(
      form.matchesConsidered === 0
        ? "Recent form: no finished matches found yet this season."
        : `Recent form (last ${form.matchesConsidered}): ${form.wins}W-${form.draws}D-${form.losses}L ` +
            `(${form.sequence.map((r) => RESULT_LABEL[r]).join(", ")}, most recent first)`,
    );

    lines.push("");
    if (nextMatches.length === 0) {
      lines.push("No upcoming Bundesliga fixtures found.");
    } else {
      lines.push("Upcoming Bundesliga fixtures:");
      lines.push(
        ...nextMatches.map(
          (m) =>
            `  ${m.isHome ? "vs" : "at"} ${m.opponentName} — ${new Date(m.kickoffUtc).toISOString().slice(0, 16).replace("T", " ")}`,
        ),
      );
    }

    lines.push("");
    if (congestion.length === 0) {
      lines.push(
        `Fixture congestion: none detected in the near term (checked: Bundesliga${checkedCompetitions.length > 0 ? ", " + checkedCompetitions.join(", ") : ""}).`,
      );
    } else {
      lines.push("Fixture congestion:");
      lines.push(
        ...congestion.map(
          (w) =>
            `  ${w.level === "triple-plus" ? "TRIPLE+" : "Double"} burden: ${w.matchCount} matches ` +
            `(${w.competitions.join(", ")}) between ${w.windowStart.slice(0, 10)} and ${w.windowEnd.slice(0, 10)} — ` +
            "increased rotation/injury risk for players from this club.",
        ),
      );
    }

    lines.push(
      "",
      `This does not know about individual injuries or confirmed lineups. Search ` +
        `"${buildLigaInsiderSearchQuery(teamName)}" for current club news before deciding anything.`,
    );

    return lines.join("\n");
  }
}

export interface CupMatchesResult {
  /** Cup competition label -> every match in it this season (all teams, not filtered to one). */
  matchesByCompetition: Map<string, OpenLigaMatch[]>;
  checkedCompetitions: string[];
}

/**
 * Fetches every CUP_COMPETITIONS match ONCE for the whole season — not
 * per-team — so a caller that needs this for many teams (e.g. ForecastService
 * scoring the whole player pool) doesn't refetch the same competition
 * repeatedly. getTeamMatchupAnalysis and ForecastService both filter the
 * shared result down to one team's matches afterward via toTeamMatchInputs.
 */
export async function fetchSeasonCupMatches(openLigaClient: OpenLigaDbClient, season: number): Promise<CupMatchesResult> {
  const matchesByCompetition = new Map<string, OpenLigaMatch[]>();
  const checkedCompetitions: string[] = [];

  let leagues;
  try {
    leagues = await openLigaClient.getAvailableLeagues();
  } catch {
    return { matchesByCompetition, checkedCompetitions };
  }

  for (const cup of CUP_COMPETITIONS) {
    const candidates = leagues.filter((l) => l.leagueSeason === season && cup.namePattern.test(l.leagueName));
    if (candidates.length === 0) continue;

    const seenMatchIds = new Set<number>();
    const matches: OpenLigaMatch[] = [];
    for (const candidate of candidates) {
      try {
        const candidateMatches = await openLigaClient.getSeasonMatches(candidate.leagueShortcut, season);
        for (const match of candidateMatches) {
          if (seenMatchIds.has(match.matchID)) continue;
          seenMatchIds.add(match.matchID);
          matches.push(match);
        }
      } catch {
        // Best-effort: one unreachable cup competition shouldn't fail the whole analysis.
      }
    }
    if (matches.length > 0) {
      matchesByCompetition.set(cup.label, matches);
      checkedCompetitions.push(cup.label);
    }
  }

  return { matchesByCompetition, checkedCompetitions };
}

/** All unique teams appearing in a season's match list (each team plays both home and away, so team1+team2 covers everyone). */
export function collectSeasonTeams(matches: OpenLigaMatch[]): OpenLigaTeam[] {
  const seen = new Map<number, OpenLigaTeam>();
  for (const match of matches) {
    seen.set(match.team1.teamId, match.team1);
    seen.set(match.team2.teamId, match.team2);
  }
  return [...seen.values()];
}

function findTeam(matches: OpenLigaMatch[], candidate: string): OpenLigaTeam | undefined {
  for (const match of matches) {
    if (matchesTeam(match.team1, candidate)) return match.team1;
    if (matchesTeam(match.team2, candidate)) return match.team2;
  }
  return undefined;
}

function matchesTeam(team: OpenLigaTeam, candidate: string | OpenLigaTeam): boolean {
  if (typeof candidate !== "string") return team.teamId === candidate.teamId;
  const c = candidate.toLowerCase().trim();
  const name = team.teamName.toLowerCase();
  const short = team.shortName.toLowerCase();
  return name.includes(c) || short.includes(c) || c.includes(short);
}

export function toTeamMatchInputs(matches: OpenLigaMatch[], team: OpenLigaTeam, competition: string): TeamMatchInput[] {
  return matches
    .filter((m) => matchesTeam(m.team1, team) || matchesTeam(m.team2, team))
    .map((m) => {
      const isHome = matchesTeam(m.team1, team);
      const opponent = isHome ? m.team2 : m.team1;
      const base: TeamMatchInput = {
        opponentName: opponent.teamName,
        kickoffUtc: m.matchDateTimeUTC,
        isHome,
        competition,
        isFinished: m.matchIsFinished,
      };
      if (!m.matchIsFinished) return base;

      const goals = deriveGoals(m, isHome);
      if (!goals) return base;

      return { ...base, result: deriveResult(goals), goalsFor: goals.goalsFor, goalsAgainst: goals.goalsAgainst };
    });
}

function deriveGoals(match: OpenLigaMatch, isHome: boolean): { goalsFor: number; goalsAgainst: number } | undefined {
  const final = match.matchResults.at(-1);
  if (!final) return undefined;
  return {
    goalsFor: isHome ? final.pointsTeam1 : final.pointsTeam2,
    goalsAgainst: isHome ? final.pointsTeam2 : final.pointsTeam1,
  };
}

function deriveResult(goals: { goalsFor: number; goalsAgainst: number }): "W" | "D" | "L" {
  if (goals.goalsFor > goals.goalsAgainst) return "W";
  if (goals.goalsFor < goals.goalsAgainst) return "L";
  return "D";
}
