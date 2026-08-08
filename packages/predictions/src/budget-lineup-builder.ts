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
 * multi-choice knapsack problem. This uses the standard greedy
 * value-density approximation (compositeScore per unit of marketValue,
 * highest first, across ALL positions at once so early picks don't starve
 * a later position of budget): well-known to be a good, cheap approximation
 * of knapsack optimality, but NOT a guaranteed-optimal solution (true
 * optimality would need integer programming/DP over a large state space).
 * A slot that can't be affordably filled from the given pool is reported in
 * unfilledSlots rather than silently left out.
 */
export function buildBudgetConstrainedLineup(
  players: PlayerValueScore[],
  budget: number,
  formation: LineupFormation = DEFAULT_FORMATION,
): BudgetLineup {
  const remainingSlots = new Map<KickbasePosition, number>(
    (Object.entries(formation) as [KickbasePosition, number][]).map(([position, count]) => [position, count]),
  );
  const sortedByValueDensity = [...players].sort((a, b) => valueDensity(b) - valueDensity(a));

  const starters: PlayerValueScore[] = [];
  let remainingBudget = budget;

  for (const player of sortedByValueDensity) {
    const slotsLeft = remainingSlots.get(player.position) ?? 0;
    if (slotsLeft <= 0) continue;
    if (player.marketValue > remainingBudget) continue;

    starters.push(player);
    remainingBudget -= player.marketValue;
    remainingSlots.set(player.position, slotsLeft - 1);
  }

  const unfilledSlots: KickbasePosition[] = [];
  for (const [position, count] of remainingSlots) {
    for (let i = 0; i < count; i++) unfilledSlots.push(position);
  }

  return {
    formation,
    starters,
    totalCost: budget - remainingBudget,
    budget,
    remainingBudget,
    unfilledSlots,
  };
}

function valueDensity(player: PlayerValueScore): number {
  return player.marketValue > 0 ? player.compositeScore / player.marketValue : 0;
}
