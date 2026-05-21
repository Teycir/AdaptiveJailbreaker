# AJAR Fix Roadmap

8 issues · 4 phases · ~6 hours total estimated effort

Complete phases 1 and 2 before committing any code — issues #1 and #2 block the app from functioning end-to-end, and issue #4 will cause a deploy-time crash even after #2 is resolved.

---

## Phase 1 — Critical bugs (~1 hour)

### #1 Snapshot event ignored — late-joining clients see empty trace

**File:** `apps/web/components/TraceViewer.tsx` · `ws.onmessage`

**Problem:** The DO sends a `snapshot` event carrying full `EvalState` to every new WebSocket client. `TraceViewer` discards it. Any client connecting after an eval starts — including a page refresh mid-run or navigating to a completed eval — sees a blank trace.

**Fix:** Handle `snapshot` in `ws.onmessage`. Walk `state.branches[currentBranchId].messages` and reconstruct `attacker_msg` / `target_msg` entries, then call `setEntries(reconstructed)`. Also replay `rollback` events from branches whose `rolledBack` flag is true.

---

### #2 `API_WORKER_URL` missing from wrangler.toml — D1 persistence never runs

**File:** `workers/engine/src/EvalSession.ts` · `persistToD1` · `wrangler.toml`

**Problem:** `EvalSession.Env` declares `API_WORKER_URL` but no `[vars]` entry or `wrangler secret put` instruction exists in `wrangler.toml`. At runtime `this.env.API_WORKER_URL` is `undefined`, so the fetch throws and the error is silently swallowed. No completed eval ever reaches D1 or the Results page.

**Fix:** Add to `wrangler.toml`:
```toml
[vars]
API_WORKER_URL = "https://ajar-api.<your-subdomain>.workers.dev"
```
Also add `API_WORKER_URL: string` to the `Env` interface in `workers/api/src/types.ts`. Document the required `wrangler secret put API_INTERNAL_SECRET` step in the README.

---

## Phase 2 — Infrastructure fixes (~2 hours)

### #3 `/internal/results` registered on the wrong router

**File:** `workers/api/src/routes/results.ts` · `workers/api/src/index.ts`

**Problem:** `resultsRouter.post("/internal/results", …)` mounts at `POST /results/internal/results` when the router is applied at `app.route("/results", …)`. The workaround in `index.ts` manually calls `resultsRouter.fetch(c.req.raw, c.env)` to paper over the mismatch. This is fragile across Hono minor versions.

**Fix:** Extract the internal handler into a dedicated `internalRouter` and register it directly:
```ts
app.route("/internal", internalRouter);
```
Remove the manual `resultsRouter.fetch` relay from `index.ts`.

---

### #4 No D1 migration file — `scorer_model` column will break on insert

**File:** `workers/api/src/routes/results.ts` · *(missing)* `db/migrations/`

**Problem:** The `INSERT` in `results.ts` includes a `scorer_model` column not in the Specs schema. No migration file exists anywhere in the repo. A fresh D1 database will throw `no such column` on the first completed eval.

**Fix:** Create `db/migrations/0001_init.sql` with the full `CREATE TABLE eval_runs` statement including `scorer_model TEXT`. Add a migration step to the deploy runbook:
```bash
wrangler d1 execute ajar-db --file=db/migrations/0001_init.sql
```

---

## Phase 3 — Engine quality (~1 hour)

### #5 `scoreTrend` emitted with stale pre-update branch as fallback

**File:** `workers/engine/src/AuditorAgent.ts` · ~line 109

**Problem:** `getCurrentBranch(state)` is called twice inline — once for the `.ok` guard, once to dereference `.value!`. The fallback is `branchResult.value` captured *before* `addMessageToState` and `addScoreToState`, so the just-recorded score is absent from the fallback trend.

**Fix:**
```ts
const updatedBranch = getCurrentBranch(state);
this.emit({ type: "score_update", score, trend: scoreTrend(updatedBranch.ok ? updatedBranch.value : branchResult.value) });
```
Better still: assert `updatedBranch.ok` and remove the fallback — a missing branch at this point is a programmer error, not a recoverable condition.

---

### #6 React Strict Mode double-mount causes duplicate trace entries in dev

**File:** `apps/web/components/TraceViewer.tsx` · `useEffect` / `_counter`

**Problem:** React 18 Strict Mode mounts and unmounts effects twice in development, producing two WebSocket connections and two streams of events. The module-level `_counter` keeps keys unique, but every event appears twice. Harmless in production.

**Fix:** Move `_counter` inside the component with `useRef`. Add a mounted flag to the effect so the second mount's connection is closed before it appends events. If snapshot reconstruction (#1) is done first, deduplication by sequence number is an alternative.

---

## Phase 4 — Algorithm fidelity (~2 hours)

### #7 `XTeamingAlgorithm` loses selected strategy after `initialize`

**File:** `packages/lib/src/algorithms/xTeaming/index.ts`

**Problem:** `initialize` picks one of three strategies but never stores it as instance state. Unlike `CrescendoAlgorithm` (stores `plan[]`) and `ActorAttackAlgorithm` (stores `character`/`scenario`), X-Teaming loses its strategic framing between every turn.

**Fix:** Add instance fields:
```ts
private selectedStrategy = "";
private strategies: string[] = [];
```
Store them in `initialize`, pass `selectedStrategy` as a hint in `buildAdaptPrompt`, and reset to `""` in `revise` so the next branch selects afresh.

---

### #8 `CrescendoAlgorithm.revise` resets plan without rebuilding it

**File:** `packages/lib/src/algorithms/crescendo/index.ts` · `revise()`

**Problem:** `revise()` sets `this.plan = []` then returns a fresh opening, but never regenerates a 5-step plan. Every post-rollback call to `nextMessage` hits `this.plan[step] === undefined`, silently dropping step-hint guidance for the entire new branch.

**Fix:** Either call a shared `buildPlan` helper inside `revise()` after generating the new opening, or inline `callLLM + parsePlan` before returning. The plan generation is one cheap LLM call at temperature 0.7 and restores coherent escalation from turn 1 on the new branch.

---

## Verification checklist

- [ ] Launch an eval, navigate away, reload `/eval/:id` — trace must replay from snapshot
- [ ] Let an eval complete — at least one row must appear in `/results` with correct turn count and status
- [ ] Deploy to a fresh environment — `wrangler d1 execute` runs without schema errors
- [ ] `POST /internal/results` with wrong secret — confirm `403`, not `200` or `404`
- [ ] Run `vitest` in `packages/lib` — all state tests pass
- [ ] Run a Crescendo eval to rollback — attacker messages after rollback still reference step hints
- [ ] Run an X-Teaming eval — `selectedStrategy` field appears in nextMessage prompt logs
