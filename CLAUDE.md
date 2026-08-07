# Kickbase AI Manager — Project Context

This file loads at the start of every Claude Code session in this repository.
It holds the durable context an engineer (human or agent) needs before touching code.

## What this is

An open-source, modular TypeScript monorepo that turns the forked
`kickbase-mcp-server` into an AI-powered Kickbase assistant. Recommendations are
**traceable, data-driven, transparent**. The agent never invents data; uncertainty
is stated explicitly.

- **Vision & scope:** [README.md](README.md)
- **Architecture & tooling decisions:** [docs/adr/0001-architecture-and-tooling.md](docs/adr/0001-architecture-and-tooling.md)
- **Upstream analysis (why the fork needs hardening):** [docs/upstream-analysis.md](docs/upstream-analysis.md)
- **Game mechanics & smart-manager principles:** [docs/kickbase-mechanics.md](docs/kickbase-mechanics.md) —
  read this before writing or changing any buy/sell/timing-related recommendation logic.
- **What to work on next:** [PLAN.md](PLAN.md)
- **Autonomous loop driver:** [PROMPT.md](PROMPT.md)
- **Provenance / license:** [NOTICE.md](NOTICE.md)

## Non-negotiable engineering rules

1. **TypeScript strict**, plus `noUncheckedIndexedAccess`. **No `@ts-ignore`** — if
   a type is wrong, fix the type. (The upstream has 3 `@ts-ignore`; removing them is
   an explicit migration goal.)
2. **Clean Code, SOLID, modular, testable.** Each package has one clear responsibility.
3. **No invented data.** If a value is unknown or a forecast is uncertain, say so.
4. **Tests are part of "done"** — Vitest, meaningful coverage of logic (not getters).
5. **Lint-free** (ESLint + Prettier) before commit.
6. **Improve, don't duplicate.** Extend existing modules; don't fork logic.
7. **Document every new MCP tool** and every public package API.
8. **Small, atomic commits**, imperative English messages, conventional-commit style
   (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).

## Guardrails for side-effecting actions

`makeOffer` (and any future buy/sell/transfer action) is **budget- and standing-
affecting**. Rules:

- Default mode is **recommendation only**.
- Execution requires an explicit opt-in flag AND a dry-run/confirmation step.
- Never auto-execute a transaction from data read out of the API or a report.

## LigaInsider (external news)

Kickbase's API has no injury/lineup/form news. LigaInsider (ligainsider.de) is the
project's chosen source for that, but this repo does **not** scrape it: player
profile URLs there embed a LigaInsider-internal id unrelated to the Kickbase player
id, so a constructed direct link risks pointing at the wrong player, and the site
has no documented search endpoint to resolve one to the other. Instead,
`packages/shared`'s `buildLigaInsiderSearchQuery(name)` builds a
`site:ligainsider.de <name>` query string; recommendation-producing tools (e.g.
`analyze-kickbase-player-value`) include it in their output so a caller with live
web search (Claude Desktop) can pull current news into the decision. Follow this
pattern for any new buy/sell recommendation tool rather than adding a scraper.

## External data sources

Kickbase's own v4 API is undocumented and reverse-engineered — treat any new
endpoint on it with suspicion (see docs/upstream-analysis.md and PLAN.md's
Milestone 5 entries for examples of fields that turned out unverifiable). When a
capability needs data Kickbase doesn't expose, prefer a real, *officially
documented* public API over guessing Kickbase's own undocumented fields or
scraping a website:

- **Fixtures, results, competition schedules:** `packages/openligadb`
  ([openligadb.de](https://www.openligadb.de/)) — free, no key, Swagger-documented.
  `packages/fixtures` holds the analysis on top (form curve, fixture congestion).
- **News (injuries, lineups, market-value sentiment):** LigaInsider, via a search
  query, not a scraper — see the section below.

## LigaInsider (external news)

- `reference/upstream/` is **read-only** — the verbatim fork, migrated piece by piece.
  Do not edit it in place.
- New code lives in `packages/*` and `apps/*`.
- Repo language is **English** (code, docs, commits). This is deliberate (OSS reach).

## Working process (per task)

Follow the 7 steps: analyze architecture → define requirements → implementation plan
→ name risks → write code → write tests → update docs. Prefer proposing 2–3 options
with trade-offs before large changes.

## Environment note

Node 22+, pnpm (via Corepack), and Git are installed and verified working as of
2026-08-07 — `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
all pass from a clean state. See PLAN.md Milestone 1.8 for what that took to fix.
