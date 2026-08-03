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

## Repository conventions

- `reference/upstream/` is **read-only** — the verbatim fork, migrated piece by piece.
  Do not edit it in place.
- New code lives in `packages/*` and `apps/*`.
- Repo language is **English** (code, docs, commits). This is deliberate (OSS reach).

## Working process (per task)

Follow the 7 steps: analyze architecture → define requirements → implementation plan
→ name risks → write code → write tests → update docs. Prefer proposing 2–3 options
with trade-offs before large changes.

## Environment note

The primary dev machine currently has **no Node/npm/pnpm on PATH**. Installing
Node 22 LTS + Corepack is the first task in [PLAN.md](PLAN.md); most build/test work
is blocked until then.
