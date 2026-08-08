import type { BaseXiClient, BaseXiPlayer } from "@kickbase-ai-manager/basexi";
import type { OpenLigaDbClient } from "@kickbase-ai-manager/openligadb";
import {
  computeFormCurve,
  computeGoalStats,
  computeHomeAwaySplit,
  getCurrentBundesligaSeasonYear,
} from "@kickbase-ai-manager/fixtures";
import {
  buildValueLineup,
  computePlayerValueScore,
  parseImpliedProbabilities,
  type KickbasePosition,
  type LineupFormation,
  type PlayerScoreInput,
  type PlayerValueScore,
  type TeamHomeAwaySplit,
  type TeamStrengthInput,
  type ValueLineup,
} from "@kickbase-ai-manager/predictions";
import { buildLigaInsiderSearchQuery, createLogger, type Logger } from "@kickbase-ai-manager/shared";
import { buildForecastSnapshot, resolveMatchdayNumber, reviewForecastAccuracy, saveForecastSnapshot } from "./forecast-log.js";
import { collectSeasonTeams, toTeamMatchInputs } from "./matchup.service.js";

const DEFAULT_LOG_DIR = "./.kickbase-forecast-log";

const KICKBASE_POSITIONS: readonly KickbasePosition[] = ["Torwart", "Abwehr", "Mittelfeld", "Sturm"];

function hasKickbasePosition(player: BaseXiPlayer): player is BaseXiPlayer & { position: KickbasePosition } {
  return (KICKBASE_POSITIONS as readonly string[]).includes(player.position);
}

/**
 * Combines BaseXI (real Kickbase player data, opt-in — see CLAUDE.md) with
 * OpenLigaDB (Bundesliga team form/goals, no auth needed) into a matchday
 * value-lineup forecast. This service only wires the two data sources
 * together and formats the result; the actual scoring formula and every
 * weight it uses live in @kickbase-ai-manager/predictions, fully disclosed
 * there. Only ever constructed when ENABLE_BASEXI=true (same gate as
 * BaseXiService) — see KickbaseMcpServer.
 */
export class ForecastService {
  private readonly logger: Logger;
  private readonly logDir: string;

  constructor(
    private readonly baseXiClient: BaseXiClient,
    private readonly openLigaClient: OpenLigaDbClient,
    options: { logger?: Logger; logDir?: string } = {},
  ) {
    this.logger = options.logger ?? createLogger();
    this.logDir = options.logDir ?? DEFAULT_LOG_DIR;
  }

  async getMatchdayValueLineup(topPerPosition = 5): Promise<string> {
    const [players, teamData] = await Promise.all([this.baseXiClient.getAllPlayers(), this.buildTeamDataMaps()]);

    const eligible = players.filter(hasKickbasePosition);
    const positionBaselines = computePositionBaselines(eligible);
    const positionAverageMarketValues = computePositionAverageMarketValues(eligible);
    const scored = eligible.map((player) =>
      this.scorePlayer(player, teamData, positionBaselines, positionAverageMarketValues),
    );
    const lineup = buildValueLineup(scored);

    await this.trySaveSnapshot(eligible, scored, lineup);

    return formatReport(scored, lineup, topPerPosition);
  }

  /**
   * Logs this forecast to disk so review-kickbase-forecast-accuracy can
   * later diff it against real outcomes — see forecast-log.ts. Best-effort:
   * a logging failure (e.g. no write permission) must never break the
   * actual forecast response.
   */
  private async trySaveSnapshot(
    eligible: (BaseXiPlayer & { position: KickbasePosition })[],
    scored: PlayerValueScore[],
    lineup: ValueLineup,
  ): Promise<void> {
    const matchday = resolveMatchdayNumber(eligible);
    if (matchday === undefined) {
      this.logger.debug("skipping forecast snapshot: no matchday could be resolved from BaseXI data");
      return;
    }

    const rawById = new Map(eligible.map((p) => [p.id, { totalPoints: p.totalPoints, matchesPlayed: p.matchesPlayed }]));
    const snapshot = buildForecastSnapshot(matchday, scored, lineup, rawById);

    try {
      await saveForecastSnapshot(this.logDir, snapshot);
    } catch (error) {
      this.logger.warn("failed to save forecast snapshot", { error: String(error) });
    }
  }

  /** Reviews every logged forecast whose matchday has since been played — see forecast-log.ts. */
  async getForecastAccuracyReview(): Promise<string> {
    const players = await this.baseXiClient.getAllPlayers();
    return reviewForecastAccuracy(this.logDir, players);
  }

  private async buildTeamDataMaps(): Promise<TeamDataMaps> {
    const season = getCurrentBundesligaSeasonYear();
    const matches = await this.openLigaClient.getSeasonMatches("bl1", season);
    const teams = collectSeasonTeams(matches);

    const strengthByName = new Map<string, TeamStrengthInput>();
    const homeAwaySplitByName = new Map<string, TeamHomeAwaySplit>();

    for (const team of teams) {
      // Full season, unsliced — computeFormCurve/computeGoalStats slice to the last 5 themselves for
      // recent-form purposes, while computeHomeAwaySplit deliberately looks at the whole season.
      const inputs = toTeamMatchInputs(matches, team, "Bundesliga");
      const form = computeFormCurve(inputs, 5);
      const goals = computeGoalStats(inputs, 5);
      const split = computeHomeAwaySplit(inputs);

      const key = normalizeTeamName(team.teamName);
      strengthByName.set(key, {
        teamName: team.teamName,
        matchesConsidered: goals.matchesConsidered,
        wins: form.wins,
        draws: form.draws,
        losses: form.losses,
        goalsFor: goals.goalsFor,
        goalsAgainst: goals.goalsAgainst,
        cleanSheets: goals.cleanSheets,
      });
      homeAwaySplitByName.set(key, { teamName: team.teamName, ...split });
    }

    return { strengthByName, homeAwaySplitByName };
  }

  private scorePlayer(
    player: BaseXiPlayer & { position: KickbasePosition },
    teamData: TeamDataMaps,
    positionBaselines: Map<KickbasePosition, number>,
    positionAverageMarketValues: Map<KickbasePosition, number>,
  ): PlayerValueScore {
    const { averagePoints, averagePointsSource, gamesConsidered } = resolveRawAverage(player);

    const ownTeamKey = normalizeTeamName(player.teamName);
    const ownTeam = teamData.strengthByName.get(ownTeamKey);
    const ownTeamHomeAwaySplit = teamData.homeAwaySplitByName.get(ownTeamKey);
    const opponentTeam = player.match_data
      ? teamData.strengthByName.get(normalizeTeamName(player.match_data.next_opponent))
      : undefined;
    const oddsString = player.match_data?.odds ?? player.next_match?.odds;
    const impliedProbabilities = oddsString ? parseImpliedProbabilities(oddsString) : undefined;
    const positionBaseline = positionBaselines.get(player.position);
    const positionAverageMarketValue = positionAverageMarketValues.get(player.position);

    const input: PlayerScoreInput = {
      id: player.id,
      name: player.name,
      position: player.position,
      teamName: player.teamName,
      marketValue: player.marketValue,
      averagePoints,
      averagePointsSource,
      gamesConsidered,
      ...(positionBaseline !== undefined && { positionBaseline }),
      ...(positionAverageMarketValue !== undefined && { positionAverageMarketValue }),
      ...(player.match_data && { isHome: player.match_data.home_game }),
      ...(ownTeamHomeAwaySplit && { ownTeamHomeAwaySplit }),
      ...(ownTeam && { ownTeam }),
      ...(opponentTeam && { opponentTeam }),
      ...(impliedProbabilities && { impliedProbabilities }),
      ...(player.momentum && { baseXiMomentum: player.momentum }),
      ...(player.next_match && { baseXiNextMatchDifficulty: player.next_match.difficulty }),
    };

    return computePlayerValueScore(input);
  }
}

interface TeamDataMaps {
  strengthByName: Map<string, TeamStrengthInput>;
  homeAwaySplitByName: Map<string, TeamHomeAwaySplit>;
}

interface RawAverage {
  averagePoints: number;
  averagePointsSource: "current-season" | "previous-season";
  gamesConsidered: number;
}

function resolveRawAverage(player: BaseXiPlayer): RawAverage {
  const usesCurrentSeason = player.matchesPlayed > 0;
  return {
    averagePoints: usesCurrentSeason ? player.avgPoints : player.avgPrevSeason,
    averagePointsSource: usesCurrentSeason ? "current-season" : "previous-season",
    gamesConsidered: usesCurrentSeason ? player.matchesPlayed : player.gamesPrevSeason,
  };
}

/**
 * The average of averagePoints across all eligible players at each position —
 * the shrinkage prior a small-sample player's own average gets pulled toward
 * (see @kickbase-ai-manager/predictions/shrinkage.ts). Computed once per call
 * over the same pool being scored, not a separately fetched "true" baseline.
 */
function computePositionBaselines(
  players: (BaseXiPlayer & { position: KickbasePosition })[],
): Map<KickbasePosition, number> {
  const sumsByPosition = new Map<KickbasePosition, { total: number; count: number }>();

  for (const player of players) {
    const { averagePoints } = resolveRawAverage(player);
    const bucket = sumsByPosition.get(player.position) ?? { total: 0, count: 0 };
    bucket.total += averagePoints;
    bucket.count += 1;
    sumsByPosition.set(player.position, bucket);
  }

  const baselines = new Map<KickbasePosition, number>();
  for (const [position, { total, count }] of sumsByPosition) {
    if (count > 0) baselines.set(position, total / count);
  }
  return baselines;
}

/**
 * The average marketValue across all eligible players at each position —
 * the denominator computeDifferentiationHint uses to flag a player as an
 * unusually expensive ("template") or unusually cheap ("differential") pick
 * relative to their peers. See differentiation.ts for why this matters in a
 * winner-take-all matchday format.
 */
function computePositionAverageMarketValues(
  players: (BaseXiPlayer & { position: KickbasePosition })[],
): Map<KickbasePosition, number> {
  const sumsByPosition = new Map<KickbasePosition, { total: number; count: number }>();

  for (const player of players) {
    const bucket = sumsByPosition.get(player.position) ?? { total: 0, count: 0 };
    bucket.total += player.marketValue;
    bucket.count += 1;
    sumsByPosition.set(player.position, bucket);
  }

  const averages = new Map<KickbasePosition, number>();
  for (const [position, { total, count }] of sumsByPosition) {
    if (count > 0) averages.set(position, total / count);
  }
  return averages;
}

function formatReport(scored: PlayerValueScore[], lineup: ValueLineup, topPerPosition: number): string {
  const lines: string[] = [
    "Matchday value-lineup forecast — BaseXI (real Kickbase data, opt-in) + OpenLigaDB team form, " +
      "combined by a fully disclosed heuristic (see rationale per player, and " +
      "@kickbase-ai-manager/predictions for the formula). This is NOT a points prediction or a " +
      "guarantee — it's an ordinal ranking aid.",
    "",
    "This league is winner-take-all per matchday (2nd and last both count as losing) — a good score " +
      "from a widely-owned player doesn't separate you from the field the way the same score from a " +
      "less obvious pick does. Each player below has a 'template'/'differential'/'neutral' price-based " +
      "hint for exactly this reason (see differentiation notes) — it's a proxy from price, not real " +
      "ownership data, so weigh it, don't follow it blindly.",
    "",
  ];

  if (scored.length > 0 && scored.every((p) => p.averagePointsSource === "previous-season")) {
    lines.push(
      "NOTE: no player has any recorded matches this season yet (pre-season). Every average " +
        "below falls back to last season's numbers, and team-form/matchup adjustments are 0% " +
        "until this season's matches start — re-run this after matchday 1 for a real signal.",
      "",
    );
  }

  lines.push(`Suggested value-XI (formation ${formatFormation(lineup.formation)}):`);
  lines.push(...lineup.starters.map((p) => `  ${formatPlayerLine(p)}`));

  if (lineup.concentrationWarnings.length > 0) {
    lines.push("", "Concentration risk (portfolio-style diversification check):");
    lines.push(...lineup.concentrationWarnings.map((w) => `  ${w}`));
  }

  if (lineup.bench.length > 0) {
    lines.push("", "Bench options (next-best per position):");
    lines.push(...lineup.bench.map((p) => `  ${formatPlayerLine(p)}`));
  }

  lines.push("", `Top ${String(topPerPosition)} per position (full shortlist beyond the XI above):`);
  for (const position of KICKBASE_POSITIONS) {
    const ranked = scored
      .filter((p) => p.position === position)
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, topPerPosition);
    lines.push(`  ${position}:`);
    lines.push(...ranked.map((p) => `    ${formatPlayerLine(p)}`));
  }

  const firstStarterName = lineup.starters[0]?.name;
  lines.push(
    "",
    "This does not know confirmed starting lineups or injuries. Before finalizing your real " +
      "lineup, search LigaInsider for each player above" +
      (firstStarterName ? `, e.g. "${buildLigaInsiderSearchQuery(firstStarterName)}"` : "") +
      " — repeat per player. If you have live web search, it's also worth checking what " +
      "well-known Kickbase YouTube/Instagram creators are currently recommending — treat that " +
      "as one more opinion to weigh critically against the disclosed scoring above, not a " +
      "source of truth (this project doesn't scrape those platforms; see CLAUDE.md).",
  );

  return lines.join("\n");
}

function formatPlayerLine(player: PlayerValueScore): string {
  const momentum = player.baseXiMomentum ? `, momentum: ${player.baseXiMomentum}` : "";
  const difficulty =
    player.baseXiNextMatchDifficulty !== undefined ? `, BaseXI difficulty: ${String(player.baseXiNextMatchDifficulty)}` : "";
  const shrunk =
    player.shrunkAveragePoints !== undefined ? `, shrunk: ${player.shrunkAveragePoints.toFixed(1)}` : "";
  const differentiation = player.differentiation ? `, ${player.differentiation.label}` : "";
  return (
    `${player.name} (${player.position}, ${player.teamName}) — score ${player.compositeScore.toFixed(1)} ` +
    `[${player.averagePointsSource}, ${String(player.gamesConsidered)}g${shrunk}, adj ${formatPct(player.adjustmentPct)}${momentum}${difficulty}${differentiation}]`
  );
}

function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatFormation(formation: LineupFormation): string {
  return `${String(formation.Torwart)}-${String(formation.Abwehr)}-${String(formation.Mittelfeld)}-${String(formation.Sturm)}`;
}

function normalizeTeamName(name: string): string {
  return name.toLowerCase().trim();
}
