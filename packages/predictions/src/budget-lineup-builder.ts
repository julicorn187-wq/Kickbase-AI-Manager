import { DEFAULT_FORMATION, type LineupFormation } from "./lineup-builder.js";
import type { KickbasePosition, PlayerValueScore } from "./types.js";

export interface BudgetLineup {
  formation: LineupFormation;
  starters: PlayerValueScore[];
  totalCost: number;
  budget: number;
  remainingBudget: number;
  /** Formation slots that couldn't be filled within budget from the given pool — one entry per unfilled slot. */
  unfilledSlots: KickbasePosition[];
}

/**
 * Fills formation slots to maximize total compositeScore within a single
 * shared budget (150M in this project's league, not per-position) — a
 * multi-choice knapsack problem.
 *
 * Deliberately NOT a pure "points per Euro" (value-density) greedy: an
 * earlier version of this function used that and a real backtest
 * (see PLAN.md) exposed why it fails for Kickbase specifically — price
 * spans ~100K to 100M+ while a single matchday's points span roughly 0-15
 * on this project's proxy scale (or a few hundred on Kickbase's real one),
 * so "points per Euro" is dominated by the cheapest possible player
 * regardless of real quality, leaving most of the budget unspent on a
 * bench-caliber squad. The fix mirrors how a real manager actually shops:
 *
 * 1. Start from the single best compositeScore per slot, ignoring cost.
 * 2. If that's within budget, done - no compromise needed.
 * 3. If over budget, repeatedly find the cheapest sacrifice: the swap
 *    (current starter -> a cheaper same-position alternative) with the
 *    smallest compositeScore lost per Euro freed, and take it. Repeat
 *    until within budget.
 * 4. If a starter has no cheaper alternative left and the squad is still
 *    over budget, that slot is dropped (reported in unfilledSlots) rather
 *    than silently exceeding the budget or inventing a player.
 *
 * This is still a heuristic, not a guaranteed-optimal knapsack solution
 * (true optimality would need integer programming), but it spends the
 * budget on quality by default and only downgrades exactly as much as the
 * budget forces it to.
 */
export function buildBudgetConstrainedLineup(
  players: PlayerValueScore[],
  budget: number,
  formation: LineupFormation = DEFAULT_FORMATION,
): BudgetLineup {
  const byPosition = groupByPosition(players);
  const starters: PlayerValueScore[] = [];
  const unfilledSlots: KickbasePosition[] = [];

  for (const position of Object.keys(formation) as KickbasePosition[]) {
    const ranked = [...(byPosition.get(position) ?? [])].sort((a, b) => b.compositeScore - a.compositeScore);
    const slotCount = formation[position];
    const picks = ranked.slice(0, slotCount);
    starters.push(...picks);
    for (let i = picks.length; i < slotCount; i++) unfilledSlots.push(position);
  }

  let totalCost = sumCost(starters);

  while (totalCost > budget) {
    const swap = findCheapestSacrifice(starters, byPosition);
    if (swap) {
      starters[swap.outIndex] = swap.inPlayer;
      totalCost -= swap.euroSaved;
      continue;
    }

    // No cheaper alternative exists for any current starter — drop the single most expensive one.
    const mostExpensiveIndex = indexOfMostExpensive(starters);
    if (mostExpensiveIndex === -1) break;
    const dropped = starters.splice(mostExpensiveIndex, 1)[0];
    if (!dropped) break;
    totalCost -= dropped.marketValue;
    unfilledSlots.push(dropped.position);
  }

  return {
    formation,
    starters,
    totalCost,
    budget,
    remainingBudget: budget - totalCost,
    unfilledSlots,
  };
}

interface Swap {
  outIndex: number;
  inPlayer: PlayerValueScore;
  euroSaved: number;
}

function findCheapestSacrifice(
  starters: PlayerValueScore[],
  byPosition: Map<KickbasePosition, PlayerValueScore[]>,
): Swap | undefined {
  let best: (Swap & { scoreLossPerEuroSaved: number }) | undefined;

  for (let i = 0; i < starters.length; i++) {
    const current = starters[i];
    if (!current) continue;
    const alternatives = (byPosition.get(current.position) ?? []).filter(
      (candidate) => candidate.marketValue < current.marketValue && !starters.includes(candidate),
    );

    for (const alternative of alternatives) {
      const euroSaved = current.marketValue - alternative.marketValue;
      const scoreLoss = current.compositeScore - alternative.compositeScore;
      const scoreLossPerEuroSaved = scoreLoss / euroSaved;
      if (!best || scoreLossPerEuroSaved < best.scoreLossPerEuroSaved) {
        best = { outIndex: i, inPlayer: alternative, euroSaved, scoreLossPerEuroSaved };
      }
    }
  }

  return best;
}

function indexOfMostExpensive(starters: PlayerValueScore[]): number {
  let bestIndex = -1;
  let bestValue = -Infinity;
  starters.forEach((player, index) => {
    if (player.marketValue > bestValue) {
      bestValue = player.marketValue;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function sumCost(players: PlayerValueScore[]): number {
  return players.reduce((sum, p) => sum + p.marketValue, 0);
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
