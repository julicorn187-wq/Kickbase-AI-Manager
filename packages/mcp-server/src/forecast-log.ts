import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BaseXiPlayer } from "@kickbase-ai-manager/basexi";
import type { KickbasePosition, PlayerValueScore, ValueLineup } from "@kickbase-ai-manager/predictions";

/**
 * Closes the loop between a forecast and what actually happened — the
 * concrete mechanism for "learn what works and what doesn't" rather than a
 * claim. BaseXI only exposes season-cumulative totalPoints/matchesPlayed,
 * not a per-matchday breakdown, so a snapshot records those two numbers AT
 * FORECAST TIME; evaluating later diffs them against the same player's
 * current totals to derive exactly how many points they scored in that one
 * matchday. This never invents a number - if the diff can't be trusted
 * (matchday not played yet, or more than one matchday passed since the
 * snapshot), that player is skipped and the reason is stated, not guessed.
 *
 * This deliberately does not auto-adjust any scoring weight. It produces a
 * plain report a human (or a future conversation) can read and decide from
 * - see CLAUDE.md/PLAN.md: every actual formula change in this project is a
 * reviewed, disclosed code change with a changelog entry, not silent drift
 * from an opaque self-tuning loop, which would be its own kind of invented
 * precision given how few matchdays a season actually has.
 */

export interface ForecastSnapshotPlayer {
  id: string;
  name: string;
  position: KickbasePosition;
  teamName: string;
  compositeScore: number;
  wasStarter: boolean;
  totalPointsBefore: number;
  matchesPlayedBefore: number;
}

export interface PositionAccuracy {
  position: KickbasePosition;
  /** How many suggested starters at this position also ended up among the actual top scorers at that position (same count as starterCount). */
  starterHits: number;
  starterCount: number;
}

export interface ForecastPlayerResult {
  id: string;
  name: string;
  position: KickbasePosition;
  wasStarter: boolean;
  predictedCompositeScore: number;
  actualPointsThisMatchday: number;
}

export interface ForecastSkippedPlayer {
  id: string;
  name: string;
  reason: string;
}

export interface ForecastEvaluationResult {
  evaluatedAtIso: string;
  positionAccuracy: PositionAccuracy[];
  playerResults: ForecastPlayerResult[];
  skippedPlayers: ForecastSkippedPlayer[];
}

export interface ForecastSnapshot {
  matchday: number;
  createdAtIso: string;
  players: ForecastSnapshotPlayer[];
  evaluation?: ForecastEvaluationResult;
}

const KICKBASE_POSITIONS: readonly KickbasePosition[] = ["Torwart", "Abwehr", "Mittelfeld", "Sturm"];

/** The matchday most of the scored players' own next_match points to — a stray missing/mismatched value shouldn't derail the whole snapshot. */
export function resolveMatchdayNumber(players: BaseXiPlayer[]): number | undefined {
  const counts = new Map<number, number>();
  for (const player of players) {
    const matchday = player.next_match?.matchday;
    if (matchday === undefined) continue;
    counts.set(matchday, (counts.get(matchday) ?? 0) + 1);
  }

  let best: number | undefined;
  let bestCount = 0;
  for (const [matchday, count] of counts) {
    if (count > bestCount) {
      best = matchday;
      bestCount = count;
    }
  }
  return best;
}

export function buildForecastSnapshot(
  matchday: number,
  scored: PlayerValueScore[],
  lineup: ValueLineup,
  rawById: Map<string, { totalPoints: number; matchesPlayed: number }>,
): ForecastSnapshot {
  const starterIds = new Set(lineup.starters.map((p) => p.id));

  const players: ForecastSnapshotPlayer[] = [];
  for (const player of scored) {
    const raw = rawById.get(player.id);
    if (!raw) continue;
    players.push({
      id: player.id,
      name: player.name,
      position: player.position,
      teamName: player.teamName,
      compositeScore: player.compositeScore,
      wasStarter: starterIds.has(player.id),
      totalPointsBefore: raw.totalPoints,
      matchesPlayedBefore: raw.matchesPlayed,
    });
  }

  return { matchday, createdAtIso: new Date().toISOString(), players };
}

function snapshotFilePath(logDir: string, matchday: number): string {
  return path.join(logDir, `matchday-${String(matchday)}.json`);
}

/** No-op if a snapshot for this matchday already exists — never clobbers an earlier prediction or an already-evaluated result. */
export async function saveForecastSnapshot(logDir: string, snapshot: ForecastSnapshot): Promise<void> {
  await mkdir(logDir, { recursive: true });
  const filePath = snapshotFilePath(logDir, snapshot.matchday);

  try {
    await readFile(filePath, "utf-8");
    return;
  } catch {
    // Doesn't exist yet - fall through and write it.
  }

  await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
}

export async function loadPendingSnapshots(logDir: string): Promise<ForecastSnapshot[]> {
  let fileNames: string[];
  try {
    fileNames = await readdir(logDir);
  } catch {
    return [];
  }

  const snapshots: ForecastSnapshot[] = [];
  for (const fileName of fileNames) {
    if (!fileName.startsWith("matchday-") || !fileName.endsWith(".json")) continue;
    try {
      const content = await readFile(path.join(logDir, fileName), "utf-8");
      const snapshot = JSON.parse(content) as ForecastSnapshot;
      if (!snapshot.evaluation) snapshots.push(snapshot);
    } catch {
      // Skip an unreadable/corrupt file rather than failing the whole review.
    }
  }
  return snapshots;
}

export async function markEvaluated(
  logDir: string,
  snapshot: ForecastSnapshot,
  evaluation: ForecastEvaluationResult,
): Promise<void> {
  const updated: ForecastSnapshot = { ...snapshot, evaluation };
  await writeFile(snapshotFilePath(logDir, snapshot.matchday), JSON.stringify(updated, null, 2), "utf-8");
}

/**
 * Diffs each snapshot player's recorded totals against their current BaseXI
 * totals. Only trusts the diff when matchesPlayed increased by exactly 1;
 * 0 means the matchday hasn't been played yet, more than 1 means matchdays
 * were skipped between forecasts (the diff would blend multiple matchdays,
 * so it's excluded rather than mislabeled as a single-matchday figure).
 * Returns undefined when nothing in the snapshot is ready to evaluate yet.
 */
export function evaluateSnapshot(
  snapshot: ForecastSnapshot,
  currentPlayers: BaseXiPlayer[],
): ForecastEvaluationResult | undefined {
  const currentById = new Map(currentPlayers.map((p) => [p.id, p]));

  const playerResults: ForecastPlayerResult[] = [];
  const skippedPlayers: ForecastSkippedPlayer[] = [];

  for (const player of snapshot.players) {
    const current = currentById.get(player.id);
    if (!current) {
      skippedPlayers.push({ id: player.id, name: player.name, reason: "no longer found in BaseXI data" });
      continue;
    }

    const matchesDelta = current.matchesPlayed - player.matchesPlayedBefore;
    if (matchesDelta === 0) {
      skippedPlayers.push({ id: player.id, name: player.name, reason: "matchday not played yet" });
      continue;
    }
    if (matchesDelta < 0) {
      skippedPlayers.push({ id: player.id, name: player.name, reason: "matchesPlayed went backwards - skipped" });
      continue;
    }
    if (matchesDelta > 1) {
      skippedPlayers.push({
        id: player.id,
        name: player.name,
        reason: `covers ${String(matchesDelta)} matchdays, not just this one - skipped for accuracy`,
      });
      continue;
    }

    playerResults.push({
      id: player.id,
      name: player.name,
      position: player.position,
      wasStarter: player.wasStarter,
      predictedCompositeScore: player.compositeScore,
      actualPointsThisMatchday: current.totalPoints - player.totalPointsBefore,
    });
  }

  if (playerResults.length === 0) return undefined;

  return {
    evaluatedAtIso: new Date().toISOString(),
    positionAccuracy: computePositionAccuracy(playerResults),
    playerResults,
    skippedPlayers,
  };
}

function computePositionAccuracy(playerResults: ForecastPlayerResult[]): PositionAccuracy[] {
  return KICKBASE_POSITIONS.map((position) => {
    const group = playerResults.filter((p) => p.position === position);
    const starterCount = group.filter((p) => p.wasStarter).length;
    if (starterCount === 0) return { position, starterHits: 0, starterCount: 0 };

    const actualTopIds = new Set(
      [...group]
        .sort((a, b) => b.actualPointsThisMatchday - a.actualPointsThisMatchday)
        .slice(0, starterCount)
        .map((p) => p.id),
    );
    const starterHits = group.filter((p) => p.wasStarter && actualTopIds.has(p.id)).length;
    return { position, starterHits, starterCount };
  });
}

export function formatEvaluationReport(snapshot: ForecastSnapshot, evaluation: ForecastEvaluationResult): string {
  const lines: string[] = [
    `Forecast accuracy review — matchday ${String(snapshot.matchday)} (forecast made ${snapshot.createdAtIso.slice(0, 10)}):`,
    "",
  ];

  for (const accuracy of evaluation.positionAccuracy) {
    if (accuracy.starterCount === 0) continue;
    lines.push(
      `  ${accuracy.position}: ${String(accuracy.starterHits)}/${String(accuracy.starterCount)} suggested ` +
        `starters were also among the actual top ${String(accuracy.starterCount)} scorers at that position.`,
    );
  }

  const sortedByActual = [...evaluation.playerResults].sort(
    (a, b) => b.actualPointsThisMatchday - a.actualPointsThisMatchday,
  );
  lines.push("", "Actual points scored this matchday (highest first):");
  lines.push(
    ...sortedByActual.map(
      (p) =>
        `  ${p.wasStarter ? "[STARTER] " : ""}${p.name} (${p.position}): ${String(p.actualPointsThisMatchday)} pts ` +
        `(predicted score was ${p.predictedCompositeScore.toFixed(1)})`,
    ),
  );

  if (evaluation.skippedPlayers.length > 0) {
    lines.push(
      "",
      `Skipped (${String(evaluation.skippedPlayers.length)}): ` +
        evaluation.skippedPlayers.map((p) => `${p.name} (${p.reason})`).join(", "),
    );
  }

  return lines.join("\n");
}

/** Evaluates every pending (not-yet-evaluated) snapshot that's ready, marks it evaluated, and returns a combined report. */
export async function reviewForecastAccuracy(logDir: string, currentPlayers: BaseXiPlayer[]): Promise<string> {
  const pending = await loadPendingSnapshots(logDir);
  if (pending.length === 0) {
    return (
      "No forecasts logged yet — run forecast-kickbase-matchday-value-lineup first, then come back " +
      "after that matchday has been played to see how it did."
    );
  }

  const reports: string[] = [];
  for (const snapshot of pending) {
    const evaluation = evaluateSnapshot(snapshot, currentPlayers);
    if (!evaluation) continue;
    await markEvaluated(logDir, snapshot, evaluation);
    reports.push(formatEvaluationReport(snapshot, evaluation));
  }

  if (reports.length === 0) {
    return `${String(pending.length)} forecast(s) logged, but none of their matchdays have been played yet.`;
  }

  return reports.join("\n\n---\n\n");
}
