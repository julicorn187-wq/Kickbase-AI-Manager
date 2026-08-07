# Kickbase Game Mechanics & Smart-Manager Principles

Reference for anything that reasons about buy/sell timing, offer prices, or squad
strategy. Split into two tiers: **confirmed** (officially documented by Kickbase
itself) and **community wisdom** (consistent advice across independent sources,
not officially documented — treat as a heuristic, not a fact).

## Confirmed (source: [Kickbase Help Center](https://en.help.kickbase.com/))

**Market value**
([source](https://en.help.kickbase.com/en/help/how-is-a-players-market-value-calculated-in-kickbase)):
- Updates **once daily, around 22:00 CET** — not continuously. This is why this
  project's trend calculations (`packages/market`) use daily data points; "1-day
  trend" and "7-day trend" map onto real, discrete update events, not an
  arbitrary sampling window.
- Driven by supply and demand **across all Kickbase users**, not just your league.
  Frequent purchases above current market value push it up; a player expiring
  unsold on the transfer market puts downward pressure on it; selling a player
  back to Kickbase itself (rather than to a manager) reduces available supply.
- A new player's initial value is based on stats, past performance, and overall
  interest — i.e., it isn't purely mechanical, so early-value moves for new/promoted
  players are inherently less predictable.

**Transfer market**
([source](https://en.help.kickbase.com/en/help/rule-3-the-transfer-market)):
- Only 10–20 of 500+ Bundesliga players are listed at any time; ~5–10 new listings
  and ~5–10 expirations happen per day. The market is a rotating, scarce sample —
  a player you want may simply not be listed yet.
- Bidding is sealed: you cannot see competing bids. Highest bid wins; ties go to
  whoever bid first.
- **Bids below the player's market value are sometimes rejected outright** — this
  is a real floor, not just "you'll lose the bid to someone else."
- When you list your own player, Kickbase itself makes you a buyback offer within
  about an hour, and other managers can also bid; you choose which offer (if any)
  to accept.

## Community wisdom (consistent across independent sources, not Kickbase-confirmed)

Cross-checked against multiple independent tip sites/guides and a community
"trading advisor" project ([LennardFe/Kickbase-Trading-Advisor](https://github.com/LennardFe/Kickbase-Trading-Advisor));
treat as heuristics a smart manager tends to follow, not verified mechanics:

- **Season-long consistency beats one big move.** Many small good decisions
  compound; there's no single transfer that "wins" a season.
- **Cut declining players early rather than hoping for a rebound** — this is
  exactly what `packages/analytics`' `decliningPlayers` list and the squad report
  already surface; the community advice validates that this is worth flagging,
  not just a mechanical curiosity.
- **Idle budget is a missed opportunity.** Budget not needed for the current
  lineup can be parked in cheap players you don't intend to start, purely to farm
  market-value growth on them. Not yet implemented here — would need
  `KickbaseApiClient` support for the league budget endpoint
  (`/v4/leagues/{leagueId}/me/budget`), which isn't built yet.
- **A rival's remaining budget shapes how aggressively they can bid.** At least
  one community tool estimates opponents' budgets from the league activity feed
  (`/v4/leagues/{leagueId}/activitiesFeed`) plus the per-matchday points-to-money
  reward formula. Neither the activity-feed field names nor the exact reward
  formula have been verified against real data in this project yet — would need
  the same live-verification treatment given to the league ranking endpoint
  before building on it (see PLAN.md).

## Where this shows up in the codebase

- `make-kickbase-offer-for-player`'s dry-run preview notes the below-market-value
  rejection risk.
- `analyze-kickbase-player-value`'s description references the confirmed
  once-daily update cadence when explaining the trend it's built on.
- `packages/analytics`' declining-players flag and `packages/reports`' squad
  report recommendations align with the "cut losses early" principle above.
