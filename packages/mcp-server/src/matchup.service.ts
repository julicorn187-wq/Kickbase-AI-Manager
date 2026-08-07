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
    const { cupInputs, checkedCompetitions } = await this.fetchCupMatches(team, season);
    const allInputs = [...bundesligaInputs, ...cupInputs];

    const form = computeFormCurve(bundesligaInputs, 5);
    const nextMatches = getUpcomingMatches(bundesligaInputs, 3);
    const congestion = computeFixtureCongestion(allInputs, 7);

    return this.formatReport(team.teamName, form, nextMatches, congestion, checkedCompetitions);
  }

  private async fetchCupMatches(
    team: OpenLigaTeam,
    season: number,
  ): Promise<{ cupInputs: TeamMatchInput[]; checkedCompetitions: string[] }> {
    const cupInputs: TeamMatchInput[] = [];
    const checkedCompetitions: string[] = [];

    let leagues;
    try {
      leagues = await this.openLigaClient.getAvailableLeagues();
    } catch {
      return { cupInputs, checkedCompetitions };
    }

    for (const cup of CUP_COMPETITIONS) {
      const candidates = leagues.filter((l) => l.leagueSeason === season && cup.namePattern.test(l.leagueName));
      if (candidates.length === 0) continue;

      const seenMatchIds = new Set<number>();
      let foundAny = false;
      for (const candidate of candidates) {
        try {
          const matches = await this.openLigaClient.getSeasonMatches(candidate.leagueShortcut, season);
          for (const match of matches) {
            if (seenMatchIds.has(match.matchID)) continue;
            seenMatchIds.add(match.matchID);
            if (matchesTeam(match.team1, team) || matchesTeam(match.team2, team)) {
              cupInputs.push(...toTeamMatchInputs([match], team, cup.label));
              foundAny = true;
            }
          }
        } catch {
          // Best-effort: one unreachable cup competition shouldn't fail the whole analysis.
        }
      }
      if (foundAny) checkedCompetitions.push(cup.label);
    }

    return { cupInputs, checkedCompetitions };
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

function toTeamMatchInputs(matches: OpenLigaMatch[], team: OpenLigaTeam, competition: string): TeamMatchInput[] {
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
      const result = m.matchIsFinished ? deriveResult(m, isHome) : undefined;
      return result === undefined ? base : { ...base, result };
    });
}

function deriveResult(match: OpenLigaMatch, isHome: boolean): "W" | "D" | "L" | undefined {
  const final = match.matchResults.at(-1);
  if (!final) return undefined;
  const ownScore = isHome ? final.pointsTeam1 : final.pointsTeam2;
  const opponentScore = isHome ? final.pointsTeam2 : final.pointsTeam1;
  if (ownScore > opponentScore) return "W";
  if (ownScore < opponentScore) return "L";
  return "D";
}
