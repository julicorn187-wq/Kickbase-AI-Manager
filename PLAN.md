# Work Plan — Kickbase AI Manager

The single source of truth for **what to do next**. The Ralph loop
([PROMPT.md](PROMPT.md)) reads this file every iteration, works the **topmost
unchecked task**, then checks it off. Keep tasks small enough to finish in one
iteration. Add newly discovered work as new checkboxes rather than expanding a task
mid-flight.

**Legend:** `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked (reason noted)

---

## Milestone 0 — Project bootstrap  ✅ (done 2026-08-03, manual)

- [x] Decide repo location, fork strategy, upstream relationship
- [x] Analyze upstream, persist findings (`docs/upstream-analysis.md`)
- [x] Write README, NOTICE, LICENSE, CLAUDE.md, ADR-0001
- [x] Preserve verbatim upstream under `reference/upstream/`
- [x] Author PLAN.md + PROMPT.md (this plan and the loop driver)
- [x] `git init` + initial commit

## Milestone 1 — Toolchain & monorepo foundation  ✅ (verified 2026-08-07)

- [x] **1.1** Add root `package.json` (private, `packageManager: pnpm@…`), `pnpm-workspace.yaml` covering `packages/*` and `apps/*`
- [x] **1.2** Add `tsconfig.base.json` — strict, `noUncheckedIndexedAccess`, `Node16` module resolution, project references ready
- [x] **1.3** Add Turborepo (`turbo.json`) with `build`, `test`, `lint`, `typecheck` pipelines
- [x] **1.4** Add ESLint (typescript-eslint, flat config) + Prettier; wire `pnpm lint`
- [x] **1.5** Add Vitest at root with a trivial passing sanity test; wire `pnpm test`
- [x] **1.6** Add `.env.example` documenting `KB_COOKIE`, `LEAGUE_ID`
- [x] **1.7** Add GitHub Actions CI: install → typecheck → lint → test → build on push/PR
- [x] **1.8** Verify `pnpm install && pnpm build && pnpm test && pnpm lint` all green — done 2026-08-07. This was not a rubber stamp: fixed a missing `@types/node` dependency (nothing typechecked at all before), a `tsc -b --noEmit` incompatibility with project references, a turbo race between the `build` and `typecheck` tasks, an MCP SDK API mismatch (server.ts/tools.ts were written against a different SDK shape than what's installed), ESLint never actually linting test files, and a broken/duplicated root `test` script. See commit history.

## Milestone 2 — `packages/shared`  ✅ (written 2026-08-04, verified 2026-08-07)
- [x] **2.1** Scaffold package (tsconfig extends base, package.json, src/index.ts)
- [x] **2.2** Env schema with zod: parse+validate `KB_COOKIE`, `LEAGUE_ID`; typed accessor; fail fast with a clear message
- [x] **2.3** Structured logger (levels; **never logs secrets or full API payloads at info** — fixes upstream finding #4)
- [x] **2.4** `Result<T,E>` / typed error primitives for the API layer
- [x] **2.5** Unit tests for env parsing (valid/invalid) and Result helpers

## Milestone 3 — `packages/kickbase-api` (hardened client)  ✅ (written 2026-08-04, verified 2026-08-07)
- [x] **3.1** Scaffold package; depend on `shared`
- [x] **3.2** Port `KickbaseApiClient` from `reference/upstream`; **remove `@ts-ignore`** (finding #1)
- [x] **3.3** Complete domain types (players, market, squad, market-value) — replace cryptic partial types (finding #7); document each field
- [x] **3.4** Robust `makeRequest`: typed errors, timeout, retry w/ backoff, rate-limit awareness, detect expired cookie → actionable error (finding #5)
- [x] **3.5** Make league configurable per call/instance, not just process env (removes single-league hard-wire)
- [x] **3.6** Unit tests with mocked `fetch` (success, non-2xx, expired cookie, malformed body)

## Milestone 4 — `packages/mcp-server` (parity, hardened)  ✅ (written 2026-08-04, verified 2026-08-07)
- [x] **4.1** Scaffold package; depend on `kickbase-api`, `shared`
- [x] **4.2** Port the 4 tools (player info, list market, my squad, make offer) with clean types, no `@ts-ignore` (finding #1 in server.ts)
- [x] **4.3** Implement `makeOffer` **guardrail**: dry-run default, explicit execute flag, confirmation echo of what will happen (finding #6)
- [x] **4.4** Port `ToolResponseBuilder`; ensure tool descriptions/docs are complete
- [x] **4.5** Wire MCP server entry (package `bin`); document `claude_desktop_config.json` usage in README
- [x] **4.6** Tests for tool handlers (service mocked) — written and passing (31/31 across the repo, see 1.8)
- [ ] **4.6b** Manual smoke test against Claude Desktop — needs Node + a real KB_COOKIE/LEAGUE_ID, do after 1.8
- [ ] **4.7** Tag **v0.1.0** — after 1.8 and 4.6b are green

## Milestone 5 — First intelligence increment (choose one to start)
> Pick the highest-value feature package and build it thin end-to-end before widening.
- [x] **5.0** `get-kickbase-league-ranking` MCP tool — season and per-matchday
  standings via `GET /v4/leagues/{leagueId}/ranking`. Read-only. Field names
  (`us`, `i`, `n`, `sp`/`spl`, `mdp`/`mdpl`) are not officially documented by
  Kickbase (no captured example response exists in the community OpenAPI
  spec); cross-referenced from two independently maintained community API
  clients that agree on them (a Postman/OpenAPI catalog only confirmed the
  path itself). Documented as a best guess in `types.ts` — verify against a
  real league before trusting it for anything high-stakes.
- [!] **5.1** `packages/core` domain entities — deferred. Skipped in favor of building 5.2 thin
  end-to-end first, per this milestone's own "pick one, build thin" framing; only one feature
  package exists so far, so a shared decoupled-entity layer has no second consumer yet to justify
  it. Revisit once a second feature package needs to share domain types with `market`.
- [x] **5.2** `packages/market` — done 2026-08-07. Ships `computeMarketValueTrends` (moved out of
  `kickbase.service.ts`, which duplicated it) and `estimateFairValue`: a documented, capped,
  transparent heuristic (current market value nudged by a damped 7-day trend, +/-15% max) that
  deliberately does not yet fold in point-performance as a second signal — see the doc comment in
  `fair-value.ts` for why. Exposed as the `analyze-kickbase-player-value` MCP tool (states a
  buy-up-to / sell-from price, plus an explicit BUY / TOO EXPENSIVE verdict for a given price).
  Unit-tested (normal, capped, negative, zero-value-guard cases). Winners/losers-across-the-market
  analysis is not built yet — this is the per-player half of 5.2, not the full scope.
- [x] **5.2a** LigaInsider integration — done 2026-08-07, as a search-query helper
  (`buildLigaInsiderSearchQuery` in `packages/shared`), not a scraper. LigaInsider profile URLs
  embed a site-internal id unrelated to the Kickbase player id, and the site has no documented
  search endpoint, so a constructed direct link risked pointing at the wrong player. Wired into
  `analyze-kickbase-player-value`'s output; documented as the pattern for future recommendation
  tools in CLAUDE.md.
- [x] **5.2b** `packages/analytics` squad valuation — done 2026-08-07. `evaluateSquad` aggregates
  total value, value gain/loss since acquisition, points, and a per-position breakdown, plus a
  list of players with a non-default `status`/`matchdayStatus` code. Deliberately does not claim
  those codes mean "injured" etc. — cross-checking a differently-keyed community API client
  (`firstName`/`marketValue` style, not this API's `fn`/`mv` style) turned up a plausible enum,
  but it comes from what looks like a different Kickbase API generation, so it is not trusted
  here; codes are surfaced raw. Exposed as `get-kickbase-squad-valuation`.
- [!] **5.2c** Matchup/fixture analysis — blocked, not started. The community OpenAPI catalog
  confirms `/v4/competitions/{competitionId}/matchdays` and the team-profile endpoint exist, but
  neither has a captured example response anywhere I could find, and the most actively maintained
  community client typed the matchday response as `any` — i.e. nobody has reliably documented its
  fields. Building this would mean inventing field names, which this project's own rules forbid.
  Unblocks if a maintainer supplies `KB_COOKIE`/`LEAGUE_ID` (via local `.env`, never pasted into
  chat) so the real response can be inspected, or if better community docs surface.
- [x] **5.3** `packages/reports` — done 2026-08-07. `buildSquadReport` combines the squad
  valuation's declining-players and attention lists (5.2b) into a Recommendations section, each
  line pointing at `analyze-kickbase-player-value` (5.2) and/or a LigaInsider search (5.2a) rather
  than deciding anything itself ("go check X", never "sell player Y") — matches the guardrail
  principle applied one level up from the money-affecting tool itself. Exposed as
  `get-kickbase-squad-report`. Kept to a single report for now (squad, not yet Daily/Matchday/
  Weekly/Market/Transfer per README's long-term vision) — thin end-to-end over breadth.
- [x] **5.4** Document the analysis method so recommendations are traceable (no invented data) —
  done for the fair-value heuristic, squad valuation, and the squad report (doc comments + PLAN
  entries throughout this milestone); the 5.2c entry above is this same discipline applied to a
  *decision not to build* something.

## Backlog / later milestones
- [ ] Feature packages: `analytics`, `scouting`, `predictions`, `transfers`, `optimizer`, `scheduler`, `notifications`, `ai`
- [ ] `apps/desktop`
- [ ] Automated report scheduling
- [ ] Proactive agent (risk/opportunity detection, watchlist upkeep)

## Standing open decisions (not loop tasks — need maintainer)
- [ ] Confirm final **license** for the combined work (currently MIT provisional — see NOTICE.md)
- [ ] Courtesy contact to upstream author (Sepper007) re: fork & attribution
- [ ] Confirm hosting: public GitHub repo now, or private until v0.1.0?

---

### Change log
- 2026-08-03 — Plan created; Milestone 0 complete.
- 2026-08-04 — Milestones 1–4 written (toolchain config, `shared`, `kickbase-api`,
  `mcp-server` with 4 tools + `makeOffer` dry-run guardrail). Unverified — no
  Node.js on the dev machine yet, so `pnpm install`/build/test/lint have not
  actually been run. Treat as a strong draft, not a green build, until 1.8 runs.
- 2026-08-07 — Node 22+/pnpm installed; ran 1.8 for the first time. Not green on
  the first attempt: fixed a missing `@types/node` dependency, a `tsc -b --noEmit`
  incompatibility with project references, a turbo race between `build` and
  `typecheck`, an MCP SDK API mismatch, ESLint never linting test files, and a
  broken/duplicated root `test` script. `pnpm install && pnpm typecheck && pnpm
  lint && pnpm test && pnpm build` now all pass from a clean state (31/31 tests).
  Milestones 1–4 promoted from written-but-unverified to verified.
