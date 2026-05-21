// GET /results — list recent eval runs from D1
// POST /internal/results — called by DO to persist a completed eval run

import { Hono } from "hono";
import type { EvalState } from "@ajar/types";
import type { Env } from "../types.ts";

export const resultsRouter = new Hono<{ Bindings: Env }>();

// ── GET /results ──────────────────────────────────────────────────────────────

resultsRouter.get("/", async (c) => {
  const algorithm = c.req.query("algorithm");
  const status = c.req.query("status");

  let query = "SELECT * FROM eval_runs";
  const clauses: string[] = [];
  const bindings: (string | number)[] = [];

  if (algorithm) {
    clauses.push("algorithm = ?");
    bindings.push(algorithm);
  }
  if (status) {
    clauses.push("status = ?");
    bindings.push(status);
  }

  if (clauses.length > 0) query += " WHERE " + clauses.join(" AND ");
  query += " ORDER BY created_at DESC LIMIT 50";

  const stmt = c.env.DB.prepare(query);
  const result = await (bindings.length > 0 ? stmt.bind(...bindings) : stmt).all();
  return c.json(result.results);
});

// ── POST /internal/results ────────────────────────────────────────────────────
// Fix #3: extracted into a dedicated internalRouter so it mounts at exactly
// POST /internal/results when registered as app.route("/internal", internalRouter).
// The old resultsRouter.post("/internal/results", …) mounted at the wrong path
// (/results/internal/results) and required a fragile manual relay in index.ts.

export const internalRouter = new Hono<{ Bindings: Env }>();

internalRouter.post("/results", async (c) => {
  const secret = c.req.header("x-internal-secret");
  if (secret !== c.env.API_INTERNAL_SECRET) {
    return c.json({ error: "unauthorized" }, 403);
  }

  const { state }: { state: EvalState } = await c.req.json();

  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO eval_runs
       (id, algorithm, target_model, attacker_model, scorer_model, goal,
        status, asr, turns, rollbacks, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      state.runId,
      state.config.algorithm,
      state.config.targetModel,
      state.config.attackerModel,
      state.config.scorerModel,
      state.config.goal,
      state.status,
      state.status === "success" ? 1.0 : 0.0,
      state.totalTurns,
      state.totalRollbacks,
      Date.now(),
      Date.now(),
    )
    .run();

  return c.json({ ok: true });
});
