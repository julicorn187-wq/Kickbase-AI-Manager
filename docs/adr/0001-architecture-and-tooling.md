# ADR-0001: Monorepo architecture, tooling, and fork strategy

- **Status:** Accepted (foundation)
- **Date:** 2026-08-03
- **Deciders:** Max Karle (maintainer), Lead Engineer (AI)

## Context

We are hard-forking `Sepper007/kickbase-mcp-server` (a single, thin npm package) and
growing it into a modular platform: an AI-powered Kickbase manager with market/squad/
matchday analysis, transfer optimization, a proactive agent, reports, and automation.
The upstream is clean but minimal and not structured for this scope
(see [upstream-analysis.md](../upstream-analysis.md)).

## Decision

### 1. Monorepo with pnpm workspaces + Turborepo

- **pnpm workspaces** for dependency management (fast, disk-efficient, strict
  `node_modules`, first-class workspace protocol).
- **Turborepo** for task orchestration and caching (`build`, `test`, `lint`, `typecheck`).
- **Rejected: Nx** — more powerful but heavier and more opinionated than this project
  needs right now. Revisit only if generators/affected-graph become essential.

### 2. Package boundaries (single responsibility each)

| Package | Responsibility |
|---------|----------------|
| `packages/shared` | Cross-cutting: env schema (zod), logger, `Result`/error types, common utils |
| `packages/kickbase-api` | Typed, hardened HTTP client for Kickbase v4; full domain models; auth/retry |
| `packages/core` | Domain entities & orchestration independent of transport (player, squad, market) |
| `packages/market` | Market data, value trends, winners/losers, buy/sell timing |
| `packages/analytics` | Squad/player analytics: strengths, risk, age, positions |
| `packages/scouting` | Player discovery, watchlists |
| `packages/predictions` | Points/price forecasts, matchday probabilities (xG/xA) |
| `packages/transfers` | Transfer candidate generation & evaluation |
| `packages/optimizer` | Optimization/simulation of transfer scenarios under constraints |
| `packages/reports` | Daily/Matchday/Weekly/Transfer/Squad/Market reports |
| `packages/scheduler` | Time-triggered jobs (refresh, report generation) |
| `packages/notifications` | Delivery channels for alerts/reports |
| `packages/ai` | Agent reasoning layer (recommendations, explanations, uncertainty) |
| `packages/mcp-server` | MCP tool surface exposed to Claude; thin adapters over the packages above |
| `apps/cli` | Command-line entry point |
| `apps/desktop` | Desktop app (later) |

Dependency direction: `apps/*` and `mcp-server` → feature packages → `core` →
`kickbase-api` → `shared`. No cycles. Feature packages never import each other's
internals directly; shared concerns move down into `core`/`shared`.

### 3. Fork strategy: verbatim reference + incremental migration

- The upstream source is preserved read-only under `reference/upstream/`.
- Code is migrated package-by-package, hardened as it moves (types completed,
  `@ts-ignore` removed, env validated, logging fixed, tests added).
- **Milestone v0.1.0 = functional parity** with the upstream's 4 tools, but strict,
  tested, lint-free, and guardrailed — then feature packages are built on top.
- We do **not** preserve upstream git history in this repo; attribution lives in
  [NOTICE.md](../../NOTICE.md).

### 4. Quality gates (enforced in CI)

TypeScript strict + `noUncheckedIndexedAccess`; ESLint + Prettier; Vitest; Turbo
pipeline must be green before a release tag. No `@ts-ignore`.

### 5. Secrets & side effects

- Kickbase session cookie is provided via env (`.env`, never committed) and validated
  by the `shared` env schema.
- Side-effecting actions (`makeOffer` and successors) are recommendation-by-default,
  opt-in for execution, and confirmation-gated (dry-run first).

## Consequences

- **Positive:** clear ownership, testable units, room to grow without a rewrite;
  the MCP surface stays thin and stable while intelligence grows behind it.
- **Negative / cost:** monorepo tooling overhead up front; migration is slower than
  editing one package, but pays off in maintainability.
- **Open items:** final license confirmation; upstream author courtesy contact;
  Node/pnpm toolchain not yet installed (blocks build/test). Tracked in [PLAN.md](../../PLAN.md).
