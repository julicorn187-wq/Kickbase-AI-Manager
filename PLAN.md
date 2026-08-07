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
- [x] **5.2c** Matchup/fixture analysis — done 2026-08-07, via a different data source than
  originally planned. Kickbase's own `/v4/competitions/{competitionId}/matchdays` endpoint was
  (and remains) a dead end: no captured example response anywhere findable, and even the most
  actively maintained community client types it as `any`. Building on it would have meant
  inventing field names. Instead, added `packages/openligadb` — a client for
  [OpenLigaDB](https://www.openligadb.de/), a free, *officially documented* football data API
  (verified live: `GET /getmatchdata/bl1/2026` returns real fixtures with confirmed field names
  `matchDateTime`, `team1`/`team2` {teamId, teamName, shortName}, `matchIsFinished`,
  `matchResults`). `packages/fixtures` computes recent form (last 5 results), next-3-fixtures, and
  fixture congestion (2+/3+ matches within 7 days, checked across the Bundesliga plus whatever
  DFB-Pokal/Champions League/Europa League/Conference League season can be dynamically discovered
  for the current year — competition shortcuts change every season in OpenLigaDB, so this is
  looked up by name+season rather than hardcoded, and a competition that can't be found is skipped
  rather than guessed). No betting-odds signal — the maintainer chose to ship without it rather
  than require a paid/registered odds-API key; revisit if wanted later (odds-api.io and similar
  have free tiers but need signup). Exposed as `analyze-kickbase-team-matchup(teamName)`; teamName
  is matched loosely (contains-match against the club's full/short name) rather than
  auto-resolved from a Kickbase player, since Kickbase's own team-name field format was never
  confirmed against real data. Verified against the live API, not just mocks.
- [x] **5.3** `packages/reports` — done 2026-08-07. `buildSquadReport` combines the squad
  valuation's declining-players and attention lists (5.2b) into a Recommendations section, each
  line pointing at `analyze-kickbase-player-value` (5.2) and/or a LigaInsider search (5.2a) rather
  than deciding anything itself ("go check X", never "sell player Y") — matches the guardrail
  principle applied one level up from the money-affecting tool itself. Exposed as
  `get-kickbase-squad-report`. Kept to a single report for now (squad, not yet Daily/Matchday/
  Weekly/Market/Transfer per README's long-term vision) — thin end-to-end over breadth.
- [x] **5.4** Document the analysis method so recommendations are traceable (no invented data) —
  done for the fair-value heuristic, squad valuation, the squad report, and the matchup/congestion
  analysis (doc comments + PLAN entries throughout this milestone). Milestone 5 is now complete:
  every item is either done or explicitly, reasoned-out deferred (5.1 only).

## Backlog / later milestones
- [x] Research real Kickbase game mechanics and smart-manager strategy, ground the assistant's
  advice in it — done 2026-08-07, see [docs/kickbase-mechanics.md](docs/kickbase-mechanics.md).
  Found and cited **official** Kickbase documentation (help.kickbase.com) for market-value update
  cadence (once daily, ~22:00 CET, supply/demand across all users) and transfer-market bidding
  rules (sealed bids, ties go to earliest, **bids below market value are sometimes rejected
  outright**) — confirmed facts, not reverse-engineering. Cross-checked several independent
  strategy-tip sources plus a community "trading advisor" tool for consistent, if unofficial,
  manager heuristics (cut declining players early — already matches this project's
  `decliningPlayers` flag; park idle budget in cheap speculative buys; a rival's remaining budget
  shapes how aggressively they can bid). Applied the confirmed facts directly:
  `make-kickbase-offer-for-player`'s dry-run preview now warns about the below-market-value
  rejection risk, and `analyze-kickbase-player-value`'s description cites the confirmed update
  cadence instead of treating "1-day trend" as an assumption.
- [ ] Idle-budget nudge (park unused budget in cheap speculative buys) — needs
  `KickbaseApiClient` support for `/v4/leagues/{leagueId}/me/budget`, not built yet
- [ ] Rival-manager budget estimator from the league activity feed — the most concrete "smart
  manager" edge found in research, via a community tool that infers opponents' budgets from
  `/v4/leagues/{leagueId}/activitiesFeed` plus the per-matchday points-to-money reward formula.
  Neither the activity-feed field names nor the reward formula are verified against real data yet
  — needs the same live-verification treatment as the league ranking endpoint before building on
  it. Real KB_COOKIE/LEAGUE_ID access (maintainer-provided, local `.env` only) would unblock this.
- [x] Auto-resolve a Kickbase player to its OpenLigaDB team — done 2026-08-07 as
  `analyze-kickbase-player-matchup(playerId)`. Solved without ever needing to confirm Kickbase's
  `tn` field format: `KickbaseService.getPlayerTeamName` returns it as-is (whatever it is) and
  hands it straight to `MatchupService`'s existing loose contains-match against OpenLigaDB's
  full/short team name, which was already built to tolerate exactly this kind of format
  uncertainty. `analyze-kickbase-team-matchup(teamName)` stays available for manual/exploratory
  use (e.g. scouting a club you don't own a player from yet).
- [x] `packages/basexi` — done 2026-08-07, **opt-in only, off by default**. During a season-long
  backtest exercise the maintainer pointed at [base-xi.de](https://www.base-xi.de/), a free
  community site that mirrors real Kickbase data (market value, position, points, status) via its
  own `/api/players` endpoint, no login required. Verified live: confirmed real positions for 20
  test players (100% match against this project's knowledge-based guesses). However, **base-xi.de's
  own robots.txt disallows automated `/api/` access** — confirmed by inspection. Since this repo is
  open source, baking in an always-on client would mean every clone of the repo automatically
  violates that disallow, not just the maintainer's own personal use. Resolved as an explicit,
  informed opt-in: `ENABLE_BASEXI=true` gates construction of `BaseXiClient`/`BaseXiService`/the
  `get-basexi-player-snapshot` tool entirely — unset (the default), none of it is ever
  instantiated or called. See CLAUDE.md's "External data sources" section. The response also
  includes a betting-odds field (`match_data.odds`) — unpopulated pre-season in testing, so 5.2c's
  odds backlog item below isn't resolved by this, just possibly easier once odds are actually
  posted and someone verifies the format live.
- [ ] `packages/core` domain entities — see 5.1's deferral note; revisit once a second package
  needs to share domain types with `market`/`analytics`
- [ ] Betting-odds signal for matchup analysis — needs a registered (free-tier) odds API key from
  the maintainer, see 5.2c (or possibly BaseXI's `match_data.odds` field, once verified live during
  the season and if the maintainer keeps `ENABLE_BASEXI` on)
- [ ] Squad-wide matchup sweep (loop `analyze-kickbase-player-matchup` over every squad player in
  one call) — not built; each call already costs 2 extra requests (player data + fixtures), so
  doing this for a full squad from one tool call needs a batching/caching decision first
- [ ] Winners/losers-across-the-whole-market analysis (5.2's original full scope; only the
  per-player half is built)
- [ ] Feature packages: `scouting`, `predictions`, `transfers`, `optimizer`, `scheduler`, `notifications`, `ai`
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
- 2026-08-08 — Corrected a project-wide (and upstream-inherited) wrong assumption
  about Kickbase auth. Live network capture from a real iPhone app session showed
  Kickbase actually authenticates via `Authorization: Bearer <JWT>`, not a
  `Cookie: kkstrauth=...` header — and Kickbase has **no web version at all**
  (mobile-app-only by design), so the "log into kickbase.de and copy a cookie"
  instructions in `.env.example`/README.md/`KickbaseAuthError` were factually
  wrong. Renamed `KB_COOKIE` → `KB_TOKEN` and switched `KickbaseApiClient` from
  sending a `Cookie` header to `Authorization: Bearer` across `shared` (env,
  logger redaction), `kickbase-api` (client + errors + tests), and `mcp-server`
  (server options + index.ts), and rewrote `.env.example`/README.md with the two
  real ways to obtain a token (the `/v4/user/login` email+password endpoint, or
  capturing it from app traffic via a local MITM proxy for OAuth-based logins).
  `docs/upstream-analysis.md`/`docs/adr/0001-*`/`reference/upstream/` are left
  untouched — they accurately document what the *upstream* fork's code did, not
  a live setup guide.
- 2026-08-08 — Added matchday value-lineup forecasting, per the maintainer's
  request to get standing recommendations for upcoming matchdays (form,
  starting-XI likelihood via LigaInsider, next-opponent strength, current
  prices via BaseXI). New `packages/predictions` (pure, disclosed scoring:
  `parseImpliedProbabilities` from posted odds, `computeMatchupAdjustment`
  combining home/away + implied win probability + team goal-difference/
  clean-sheet record — GK/DEF judged on clean-sheet suitability, MID/FWD on
  scoring suitability — all capped at ±25% and fully explained in a returned
  `rationale`, and `buildValueLineup`, a greedy formation slot-fill). Extended
  `packages/fixtures` with `computeGoalStats` (goals for/against, clean
  sheets) and `packages/basexi`'s types with the real `momentum`/`next_match`
  fields (discovered via a live inspection of `/api/players`, same precedent
  as the original BaseXI field modeling). New opt-in tool
  `forecast-kickbase-matchday-value-lineup` in `mcp-server` (gated behind
  `ENABLE_BASEXI`, same as `get-basexi-player-snapshot`). BaseXI's `momentum`
  and `next_match.difficulty` are surfaced as-is, never scored — their scale
  and methodology aren't documented, so no weight for them would be honest.
  IMPORTANT caveat discovered while building this: as of 2026-08-08 the
  2026/27 Bundesliga season has not started yet (matchday 1 is 2026-08-28),
  so every player's `matchesPlayed` is 0 and there is no current-season form
  to use — the tool falls back to last season's averages and says so
  explicitly in its output. Re-verify the forecast's usefulness once real
  matches start.
- 2026-08-08 — Added two quant-finance-inspired refinements to
  `packages/predictions`, per the maintainer's request to draw on quant
  techniques and to weigh (not blindly follow) community Kickbase creator
  opinions:
  - `shrinkage.ts`: `applyShrinkage` — empirical-Bayes/credibility-weighted
    shrinkage (the same "don't trust a noisy small sample at face value"
    logic used in quant equity factor models and actuarial credibility
    theory). A player's averagePoints is pulled toward the position's
    average across the scored pool (`positionBaseline`, computed by
    `ForecastService`) in proportion to `gamesConsidered` — a player with 2
    games played is scored far more conservatively than one with 30.
    `compositeScore` uses the shrunk value when a baseline is supplied;
    the raw figure is still shown for transparency. Optional — omitting
    `positionBaseline` skips shrinkage entirely.
  - `lineup-builder.ts`: `buildValueLineup` now returns
    `concentrationWarnings` — portfolio-concentration-risk logic (don't
    overweight one "sector"): flags any club with more than 2 starters in
    the suggested XI, since one bad result for that club would then swing
    several picks at once.
  Also documented in CLAUDE.md that community Kickbase YouTube/Instagram
  creator recommendations are a live-web-search input at forecast time
  (same non-scraping pattern as LigaInsider), never an automated
  "channels I follow" background job — Instagram/YouTube ToS make that a
  clearly worse idea than the already-rejected LigaInsider scraper, and
  there's no reliable way to resolve a creator's opinion to a Kickbase
  player id automatically anyway. The forecast tool's own output now
  reminds the caller to weigh such opinions critically against the
  disclosed scoring, not defer to them.
  Verified clean: typecheck, lint, 154/154 tests, and build all pass.
