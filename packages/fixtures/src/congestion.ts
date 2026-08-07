import type { TeamMatchInput } from "./types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CongestionWindow {
  windowStart: string;
  windowEnd: string;
  matchCount: number;
  competitions: string[];
  level: "double" | "triple-plus";
}

/**
 * Greedily clusters upcoming matches (across whatever competitions are
 * present in the input — pass Bundesliga + cup + European fixtures
 * together to detect a genuine "double/triple burden" week) into
 * non-overlapping windows of `windowDays`, starting each window at the
 * next not-yet-clustered match. Windows with only one match are dropped;
 * the rest are flagged "double" (2 matches) or "triple-plus" (3+).
 */
export function computeFixtureCongestion(matches: TeamMatchInput[], windowDays = 7): CongestionWindow[] {
  const upcoming = [...matches]
    .filter((m) => !m.isFinished)
    .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());

  const windows: CongestionWindow[] = [];
  let i = 0;

  while (i < upcoming.length) {
    const clusterStartMatch = upcoming[i];
    if (!clusterStartMatch) break;

    const clusterEndMs = new Date(clusterStartMatch.kickoffUtc).getTime() + windowDays * MS_PER_DAY;
    const cluster: TeamMatchInput[] = [];
    let j = i;
    while (j < upcoming.length) {
      const candidate = upcoming[j];
      if (!candidate || new Date(candidate.kickoffUtc).getTime() > clusterEndMs) break;
      cluster.push(candidate);
      j++;
    }

    if (cluster.length >= 2) {
      const last = cluster[cluster.length - 1];
      windows.push({
        windowStart: clusterStartMatch.kickoffUtc,
        windowEnd: last ? last.kickoffUtc : clusterStartMatch.kickoffUtc,
        matchCount: cluster.length,
        competitions: [...new Set(cluster.map((m) => m.competition))],
        level: cluster.length >= 3 ? "triple-plus" : "double",
      });
    }

    i = j;
  }

  return windows;
}
