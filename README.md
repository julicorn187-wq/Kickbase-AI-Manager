# Kickbase AI Manager

> An open-source, AI-powered assistant for [Kickbase](https://www.kickbase.com/) —
> the German fantasy football manager. It does not just display data: it
> **analyzes, prioritizes, and supports decisions** like a professional sporting
> director would.

**Status:** 🚧 Active development. The toolchain, the 4 ported-and-hardened upstream
tools, and a first intelligence increment (fair-value analysis, squad valuation and
reports, league ranking, matchup/fixture-congestion analysis) are built, tested, and
verified (`pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
all pass from a clean state). See [PLAN.md](PLAN.md) for exactly what's done vs. next.

---

## Vision

The Kickbase AI Manager aims to become the most capable AI assistant for Kickbase.
Every recommendation it makes must be **traceable, data-driven, and transparent**.
It never invents information — uncertainty is always communicated explicitly.

Planned capability areas (long-term):

- **Market analysis** — market overview, value trends, winners/losers, buy/sell timing, price forecasts
- **Squad analysis** — strengths/weaknesses, budget, value, age structure, injuries, risk, positions
- **Matchday analysis** — matchups, opponent/form/home-away, xG/xA, points probabilities
- **Transfer optimization** — optimal transfers under budget, potential, risk, fixtures, form, availability
- **Proactive AI agent** — watchlists, opportunity/risk detection, automated reports, reasoned recommendations
- **Automated reports** — Daily, Matchday, Weekly, Transfer, Squad, Market

By default the agent produces **recommendations**. Executing prepared buy/sell
actions is only possible after explicit, per-action authorization (see
[ADR-0001](docs/adr/0001-architecture-and-tooling.md) and the `makeOffer` guardrail
in the plan).

## Architecture (target)

A modular TypeScript monorepo (pnpm workspaces + Turborepo). See
[docs/adr/0001-architecture-and-tooling.md](docs/adr/0001-architecture-and-tooling.md)
for the full rationale and package boundaries.

```
apps/            desktop, cli
packages/        mcp-server, kickbase-api, openligadb, market, analytics,
                 fixtures, reports, shared
                 (planned: core, scouting, transfers, optimizer, predictions,
                 scheduler, notifications, ai — see PLAN.md)
docs/            architecture decisions, analysis
reference/       forked upstream source (to be migrated, do not edit in place)
```

`packages/openligadb` is this project's second external data source, alongside
`packages/kickbase-api`: a client for [OpenLigaDB](https://www.openligadb.de/), a
free, publicly documented football data API used for fixtures, results, and form —
data Kickbase's own API doesn't expose. `packages/fixtures` holds the analysis logic
that runs on top of it (form curve, fixture-congestion detection).

## How this project is built

Development runs as an **autonomous "Ralph" loop**: a durable driver prompt
([PROMPT.md](PROMPT.md)) that, on every iteration, reads the work plan
([PLAN.md](PLAN.md)), picks the next open task, implements it under strict quality
gates, tests it, commits, and checks it off. See [PLAN.md](PLAN.md) to know exactly
what happens next.

## Getting started (developers)

> Requires **Node.js 22 LTS** and **pnpm** (via Corepack). Not yet installed on the
> primary dev machine — this is the first task in [PLAN.md](PLAN.md).

```bash
corepack enable
pnpm install
pnpm build
pnpm test
```

## MCP server & tools

`packages/mcp-server` exposes ten tools by default (three more are opt-in) via the
Model Context Protocol. The four ported from the upstream fork are hardened (strict
types, no `@ts-ignore`, typed errors, retry/timeout, and a confirmation guardrail
on the money-affecting one); the rest are new:

| Tool | Description | Side effects |
|------|-------------|---------------|
| `get-kickbase-player-information` | Player performance and market-value data (incl. 1-day/7-day value trend) for a `playerId` | None |
| `list-kickbase-market` | Players currently listed on the market, soonest-expiring first | None |
| `get-my-kickbase-squad` | Your current squad with position, points, market value, status | None |
| `get-kickbase-squad-valuation` | Squad totals (value, value gain/loss, points), a per-position breakdown, and players with a non-default status code worth a look | None |
| `get-kickbase-squad-report` | Squad valuation plus a Recommendations section: for declining-value or flagged players, suggests checking fair value and searching LigaInsider before deciding anything | None |
| `get-kickbase-league-ranking` | League standings (name, points, placement); omit `dayNumber` for the season table or pass it for a single matchday | None |
| `analyze-kickbase-player-value` | Estimates a fair value from market-value momentum and states up to what price a buy is reasonable; pass `consideredPrice` for an explicit BUY / TOO EXPENSIVE verdict. Transparent heuristic, not a guarantee — see [packages/market](packages/market/src/fair-value.ts). Points callers at a LigaInsider search for news the heuristic can't see | None |
| `analyze-kickbase-team-matchup` | A club's recent form (last 5 results), next 3 Bundesliga fixtures, and fixture-congestion detection (2+/3+ matches within 7 days across Bundesliga/DFB-Pokal/European competitions) — rotation/injury risk context for a player from that club. Sourced from [OpenLigaDB](https://www.openligadb.de/), not Kickbase's API | None |
| `analyze-kickbase-player-matchup` | Same as `analyze-kickbase-team-matchup`, but takes a `playerId` and resolves the player's real club automatically (via Kickbase's own team-name field) instead of requiring you to already know/pass the club name | None |
| `make-kickbase-offer-for-player` | Places an offer on a player at a given price | **Budget-affecting.** Defaults to a dry run that only previews the offer; pass `confirm: true` to actually submit it (see [Guardrails](CLAUDE.md#guardrails-for-side-effecting-actions)) |
| `get-basexi-player-snapshot` *(opt-in)* | Real current Kickbase market value, position, points, and status for a player, from [base-xi.de](https://www.base-xi.de/), an unofficial community mirror. **Disabled by default** — base-xi.de's own robots.txt disallows automated `/api/` access, so this only runs if you set `ENABLE_BASEXI=true` yourself. See CLAUDE.md's "External data sources" section before enabling it | None |
| `forecast-kickbase-matchday-value-lineup` *(opt-in)* | Combines BaseXI's real player data with OpenLigaDB's team form/goal-difference/clean-sheet record, each team's own measured home/away split, and fixture-congestion risk (Bundesliga + cup double/triple gameweeks) into a value-lineup shortlist (a suggested XI, bench, and top-N per position), with a fully disclosed rationale per player, a price-based "template/differential" hint for this league's winner-take-all format, and explicit flags for starters with a non-default BaseXI status or upcoming congestion — see [packages/predictions](packages/predictions/src/matchup-adjustment.ts). An ordinal ranking aid, not a points prediction; doesn't know your squad/budget/confirmed lineups. Logs every forecast for later accuracy review. Same opt-in gate as `get-basexi-player-snapshot` | None (writes a local prediction-log file, not your Kickbase account) |
| `review-kickbase-forecast-accuracy` *(opt-in)* | Diffs every logged forecast whose matchday has since been played against real BaseXI point totals, and reports per-position hit rate plus every player's actual points — the concrete "learn what worked" feedback loop. Never auto-adjusts the scoring formula; see [packages/mcp-server/src/forecast-log.ts](packages/mcp-server/src/forecast-log.ts). Same opt-in gate as `get-basexi-player-snapshot` | None |

### Using it with Claude Desktop

1. Build the server: `pnpm --filter @kickbase-ai-manager/mcp-server build`
2. Add it to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kickbase": {
      "command": "node",
      "args": ["/absolute/path/to/kickbase-ai-manager/packages/mcp-server/build/index.js"],
      "env": {
        "KB_TOKEN": "<your Kickbase Bearer token>",
        "LEAGUE_ID": "<your league id>"
      }
    }
  }
}
```

3. Restart Claude Desktop. The four tools above become available in chat.

## Disclaimer

Kickbase does **not** provide an official public API, and has no web version at
all (it's mobile-app-only by design). This project talks to Kickbase's internal
v4 endpoints using a user-supplied Bearer token (`Authorization: Bearer <token>`),
based on community documentation and live traffic inspection. Consequences:

- The API may change or break without notice.
- Use is subject to Kickbase's Terms of Service — you are responsible for your own
  usage. This project is unaffiliated with and not endorsed by Kickbase.
- No real money is involved; Kickbase budgets are virtual. Automated actions still
  affect your real league standing and are therefore **opt-in and confirmation-gated**.

## Credits & license

Hard fork of and built upon
[Sepper007/kickbase-mcp-server](https://github.com/Sepper007/kickbase-mcp-server)
(see [NOTICE.md](NOTICE.md)). Licensed under [MIT](LICENSE) *(provisional — see NOTICE)*.
