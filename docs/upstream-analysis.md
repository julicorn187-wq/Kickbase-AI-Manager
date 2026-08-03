# Upstream Analysis — kickbase-mcp-server

Analysis of the forked base at commit `7eced8d` (2025-09-26). This is the factual
basis for the hardening goals in [PLAN.md](../PLAN.md).

## Summary

The upstream is small, cleanly layered, but very thin (~250 lines of logic, 4 tools,
5 endpoints, 0 tests). Its real value is API knowledge — Kickbase's cryptic field
names, the v4 endpoints, and the cookie-auth pattern — not code volume. It is a
usable **seed**, not a foundation.

## Upstream architecture

```
index.ts → server/mcp-server.ts → services/kickbase.service.ts → api/kickbase-client.ts
                                 → tools/index.ts (4 tools)
                                 → types/, utils/
```

Layered, dependency-injected (service receives client), ES modules, `strict: true`.
Single npm package, hard-wired to one league via `LEAGUE_ID` env, cookie auth.

The four exposed MCP tools:
`get-kickbase-player-information`, `list-kickbase-market`,
`make-kickbase-offer-for-player`, `get-my-kickbase-squad`.

## Findings (to fix during migration)

| # | Finding | Location | Why it matters |
|---|---------|----------|----------------|
| 1 | 3× `@ts-ignore` defeat strict mode | `api/kickbase-client.ts:11`, `services/kickbase.service.ts:43`, `server/mcp-server.ts:42` | Type safety is actually leaky; `SquadPlayer` type does not match real access |
| 2 | No env validation — `KB_COOKIE`/`LEAGUE_ID` read raw from `process.env` | `api/kickbase-client.ts:9-13` | `zod` is a dependency but only used for tool inputs, not config |
| 3 | Zero tests, no lint/prettier | `package.json` | Contradicts testable/lint-free requirements |
| 4 | `console.error(JSON.stringify(data))` dumps full API responses | `api/kickbase-client.ts` | Noisy; leaks player/session data into logs |
| 5 | No error/retry/rate-limit handling, no cookie refresh | `makeRequest` | Cookie auth expires → server silently unusable |
| 6 | `makeOffer` is a real, budget-affecting action with no guardrail | service/tools | Needs dry-run + confirmation layer (see CLAUDE.md) |
| 7 | Incomplete, cryptic types (`fn/n/mv/i/exs`) | `types/` | Analytics/predictions need full, named domain models |
| 8 | ISC declared in `package.json`, no `LICENSE` file, empty author | root | Preserve attribution on fork (done in NOTICE.md) |

## Strategic / legal notes

- **No official Kickbase API.** Reverse-engineered v4 endpoints + session cookie.
  Brittle and ToS-sensitive — surfaced as a README disclaimer.
- **Automated buy/sell:** virtual budget (no real money) but affects real league
  standing → recommendation-by-default, execution opt-in + confirmation-gated.

## How the upstream maps onto target packages

| Upstream | Target package |
|----------|----------------|
| `api/kickbase-client.ts`, `types/` | `packages/kickbase-api` |
| `services/kickbase.service.ts` | split across `market`, `analytics`, `scouting`, … |
| `tools/`, `server/`, `utils/response-builder.ts` | `packages/mcp-server` |
| config/env plumbing | `packages/shared` |
