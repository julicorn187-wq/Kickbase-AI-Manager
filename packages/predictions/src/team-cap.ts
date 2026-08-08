import type { KickbasePosition, PlayerValueScore } from "./types.js";

const KICKBASE_POSITIONS: readonly KickbasePosition[] = ["Torwart", "Abwehr", "Mittelfeld", "Sturm"];

/**
 * Keeps at most `maxPerTeam` candidates per club (ranked by compositeScore) —
 * a pre-filter a caller runs on a scored player pool BEFORE
 * buildValueLineup/buildBudgetConstrainedLineup, so those functions can no
 * longer even consider over-concentrating on one team (see
 * concentration.ts's computeConcentrationWarnings, which only warns after
 * the fact; this prevents it upfront).
 *
 * A real walk-forward backtest across 18 matchdays of the 2025/26 season
 * (see PLAN.md) found that an earlier version of this, which ALSO
 * guaranteed at least one candidate per (team, position) to avoid
 * accidentally excluding every team's goalkeeper from the pool, let some
 * teams supply 3-4 candidates instead of the intended cap — in 5 of 18
 * matchdays, in exactly the concentration pattern this function exists to
 * prevent. The fix: cap strictly per team first, and only rescue a
 * position GLOBALLY (across the whole pool, not per team) if capping left
 * literally zero candidates for it anywhere. That adds at most one extra
 * candidate for ONE team in that rare case, not a guaranteed extra slot for
 * every team.
 */
export function capCandidatesPerTeam(players: PlayerValueScore[], maxPerTeam: number): PlayerValueScore[] {
  const byTeam = new Map<string, PlayerValueScore[]>();
  for (const player of players) {
    const group = byTeam.get(player.teamName) ?? [];
    group.push(player);
    byTeam.set(player.teamName, group);
  }

  const capped: PlayerValueScore[] = [];
  for (const group of byTeam.values()) {
    const ranked = [...group].sort((a, b) => b.compositeScore - a.compositeScore);
    capped.push(...ranked.slice(0, maxPerTeam));
  }

  for (const position of KICKBASE_POSITIONS) {
    if (capped.some((p) => p.position === position)) continue;
    const bestGlobally = [...players]
      .filter((p) => p.position === position)
      .sort((a, b) => b.compositeScore - a.compositeScore)[0];
    if (bestGlobally) capped.push(bestGlobally);
  }

  return capped;
}
