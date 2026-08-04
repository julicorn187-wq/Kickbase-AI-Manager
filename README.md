# Kickbase AI Manager

> An open-source, AI-powered assistant for [Kickbase](https://www.kickbase.com/) —
> the German fantasy football manager. It does not just display data: it
> **analyzes, prioritizes, and supports decisions** like a professional sporting
> director would.

**Status:** 🚧 Early foundation. This repository currently contains the project
scaffold, architecture decisions, and an autonomous work plan. Functional code is
being migrated and hardened from the forked upstream (see below) iteration by
iteration.

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
packages/        mcp-server, core, kickbase-api, analytics, scouting,
                 transfers, optimizer, predictions, market, reports,
                 scheduler, notifications, ai, shared
docs/            architecture decisions, analysis
reference/       forked upstream source (to be migrated, do not edit in place)
```

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

`packages/mcp-server` exposes four tools via the Model Context Protocol, functionally
at parity with the upstream fork but hardened (strict types, no `@ts-ignore`, typed
errors, retry/timeout, and a confirmation guardrail on the money-affecting one):

| Tool | Description | Side effects |
|------|-------------|---------------|
| `get-kickbase-player-information` | Player performance and market-value data (incl. 1-day/7-day value trend) for a `playerId` | None |
| `list-kickbase-market` | Players currently listed on the market, soonest-expiring first | None |
| `get-my-kickbase-squad` | Your current squad with position, points, market value, status | None |
| `make-kickbase-offer-for-player` | Places an offer on a player at a given price | **Budget-affecting.** Defaults to a dry run that only previews the offer; pass `confirm: true` to actually submit it (see [Guardrails](CLAUDE.md#guardrails-for-side-effecting-actions)) |

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
        "KB_COOKIE": "<your session cookie>",
        "LEAGUE_ID": "<your league id>"
      }
    }
  }
}
```

3. Restart Claude Desktop. The four tools above become available in chat.

## Disclaimer

Kickbase does **not** provide an official public API. This project talks to
Kickbase's internal v4 endpoints using a user-supplied session cookie
(`kkstrauth`), based on community documentation. Consequences:

- The API may change or break without notice.
- Use is subject to Kickbase's Terms of Service — you are responsible for your own
  usage. This project is unaffiliated with and not endorsed by Kickbase.
- No real money is involved; Kickbase budgets are virtual. Automated actions still
  affect your real league standing and are therefore **opt-in and confirmation-gated**.

## Credits & license

Hard fork of and built upon
[Sepper007/kickbase-mcp-server](https://github.com/Sepper007/kickbase-mcp-server)
(see [NOTICE.md](NOTICE.md)). Licensed under [MIT](LICENSE) *(provisional — see NOTICE)*.
