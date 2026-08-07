/**
 * Minimal, transport-agnostic shape this package needs from a squad
 * player — deliberately not importing kickbase-api's wire types, so this
 * package stays testable without a dependency on the API client.
 */
export interface SquadValuationPlayerInput {
  id: string;
  name: string;
  marketValue: number;
  /** Market value gain/loss since acquisition, as reported by the API. */
  marketValueGainLoss: number;
  points: number;
  averagePoints: number;
  position: number;
  /**
   * Raw status code from the API. Meaning beyond "0 = no issue" is not
   * confirmed for this API generation (see packages/analytics/README or
   * CLAUDE.md) — surfaced as-is rather than interpreted as e.g. "injured".
   */
  status: number;
  /** Same caveat as status, for the current-matchday-specific code. */
  matchdayStatus: number;
}

export interface PositionBreakdownEntry {
  position: number;
  playerCount: number;
  totalMarketValue: number;
}

export interface AttentionEntry {
  id: string;
  name: string;
  status: number;
  matchdayStatus: number;
}

export interface DecliningPlayerEntry {
  id: string;
  name: string;
  marketValueGainLoss: number;
}

/** Cap on how many declining players to surface, worst first. */
const MAX_DECLINING_PLAYERS = 5;

export interface SquadValuation {
  playerCount: number;
  totalMarketValue: number;
  totalMarketValueGainLoss: number;
  totalPoints: number;
  averagePointsPerPlayer: number;
  positionBreakdown: PositionBreakdownEntry[];
  /** Players whose status or matchdayStatus is non-zero — worth a manual look. */
  playersNeedingAttention: AttentionEntry[];
  /** Up to 5 players with the largest market-value loss since acquisition, worst first. */
  decliningPlayers: DecliningPlayerEntry[];
}

/**
 * Aggregates a squad into totals, a per-position breakdown, and a list of
 * players whose raw status code isn't the default 0 (see the caveat on
 * SquadValuationPlayerInput.status — this does not claim to know why).
 */
export function evaluateSquad(players: SquadValuationPlayerInput[]): SquadValuation {
  const totalMarketValue = sum(players.map((p) => p.marketValue));
  const totalMarketValueGainLoss = sum(players.map((p) => p.marketValueGainLoss));
  const totalPoints = sum(players.map((p) => p.points));

  return {
    playerCount: players.length,
    totalMarketValue,
    totalMarketValueGainLoss,
    totalPoints,
    averagePointsPerPlayer: players.length === 0 ? 0 : totalPoints / players.length,
    positionBreakdown: buildPositionBreakdown(players),
    playersNeedingAttention: players
      .filter((p) => p.status !== 0 || p.matchdayStatus !== 0)
      .map((p) => ({ id: p.id, name: p.name, status: p.status, matchdayStatus: p.matchdayStatus })),
    decliningPlayers: players
      .filter((p) => p.marketValueGainLoss < 0)
      .sort((a, b) => a.marketValueGainLoss - b.marketValueGainLoss)
      .slice(0, MAX_DECLINING_PLAYERS)
      .map((p) => ({ id: p.id, name: p.name, marketValueGainLoss: p.marketValueGainLoss })),
  };
}

function buildPositionBreakdown(players: SquadValuationPlayerInput[]): PositionBreakdownEntry[] {
  const byPosition = new Map<number, SquadValuationPlayerInput[]>();
  for (const player of players) {
    const group = byPosition.get(player.position) ?? [];
    group.push(player);
    byPosition.set(player.position, group);
  }

  return [...byPosition.entries()]
    .map(([position, group]) => ({
      position,
      playerCount: group.length,
      totalMarketValue: sum(group.map((p) => p.marketValue)),
    }))
    .sort((a, b) => a.position - b.position);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
