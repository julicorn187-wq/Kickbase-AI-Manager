import type { KickbasePosition, PlayerValueScore } from "./types.js";

export type LineupFormation = Record<KickbasePosition, number>;

/** A common balanced Bundesliga-style formation (4-4-2 outfield + 1 GK), used when no formation is given. */
export const DEFAULT_FORMATION: LineupFormation = { Torwart: 1, Abwehr: 4, Mittelfeld: 4, Sturm: 2 };

export interface ValueLineup {
  formation: LineupFormation;
  starters: PlayerValueScore[];
  /** Up to 3 next-best players per position, in case a starter is unavailable or already owned by someone else. */
  bench: PlayerValueScore[];
}

/**
 * Fills formation slots with the highest-compositeScore player(s) available
 * per position, across whatever player pool was passed in. This is a simple
 * greedy slot-fill, not a real squad optimizer: it has no knowledge of your
 * actual squad, your remaining budget, or who you already own — treat the
 * result as a shortlist of value picks by position, not a ready-to-submit
 * lineup order.
 */
export function buildValueLineup(
  players: PlayerValueScore[],
  formation: LineupFormation = DEFAULT_FORMATION,
): ValueLineup {
  const byPosition = groupByPosition(players);
  const starters: PlayerValueScore[] = [];
  const bench: PlayerValueScore[] = [];

  for (const position of Object.keys(formation) as KickbasePosition[]) {
    const ranked = [...(byPosition.get(position) ?? [])].sort((a, b) => b.compositeScore - a.compositeScore);
    const slotCount = formation[position];
    starters.push(...ranked.slice(0, slotCount));
    bench.push(...ranked.slice(slotCount, slotCount + 3));
  }

  return { formation, starters, bench };
}

function groupByPosition(players: PlayerValueScore[]): Map<KickbasePosition, PlayerValueScore[]> {
  const map = new Map<KickbasePosition, PlayerValueScore[]>();
  for (const player of players) {
    const group = map.get(player.position) ?? [];
    group.push(player);
    map.set(player.position, group);
  }
  return map;
}
