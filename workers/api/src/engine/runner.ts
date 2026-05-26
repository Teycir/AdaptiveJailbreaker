// workers/api/src/engine/runner.ts
// Runs AuditorAgent inside a waitUntil background task.
// Persists every emitted event to KV (events:<id>) and
// patches the session state (session:<id>) after each event.
// On completion, writes the final result row to D1.

import type { TraceEvent, EvalState, EvalStatus } from "@ajar/types";
import { AuditorAgent } from "@ajar/engine";
import type { Env } from "../types.ts";

const SESSION_TTL = 3600;
const EVENTS_TTL  = 3600;

// ── KV helpers ────────────────────────────────────────────────────────────────

// Each stored entry wraps the event with a server-side timestamp.
type StoredEvent = { ts: number; event: TraceEvent };

async function appendEvent(
  kv: KVNamespace,
  evalId: string,
  event: TraceEvent,
): Promise<void> {
  const raw = await kv.get(`events:${evalId}`);
  const events: StoredEvent[] = raw ? (JSON.parse(raw) as StoredEvent[]) : [];
  events.push({ ts: Date.now(), event });
  await kv.put(`events:${evalId}`, JSON.stringify(events), {
    expirationTtl: EVENTS_TTL,
  });
}

async function patchSession(
  kv: KVNamespace,
  evalId: string,
  patch: Partial<EvalState>,
): Promise<void> {
  const raw = await kv.get(`session:${evalId}`);
  if (!raw) return;
  const session = JSON.parse(raw) as Record<string, unknown>;
  await kv.put(
    `session:${evalId}`,
    JSON.stringify({ ...session, ...patch }),
    { expirationTtl: SESSION_TTL },
  );
}

// ── D1 persistence ────────────────────────────────────────────────────────────

async function persistResult(db: D1Database, state: EvalState): Promise<void> {
  await db
    .prepare(
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
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runEval(
  evalId: string,
  env: Env,
): Promise<void> {
  const kv = env.SESSIONS;
  
  try {

  // Load config from the session we just stored in POST /evals
  const raw = await kv.get(`session:${evalId}`);
  if (!raw) {
    console.error(`[runner] session not found: ${evalId}`);
    return;
  }

  const session = JSON.parse(raw) as { config: import("@ajar/types").EvalConfig; apiKey: string };
  const { config, apiKey } = session;

  if (!apiKey) {
    await patchSession(kv, evalId, { status: "failed" });
    await appendEvent(kv, evalId, {
      type: "status_change",
      status: "failed",
      message: "No API key in session — check GEMINI_API_KEYS secret",
    } as TraceEvent);
    return;
  }

  // Build the emit callback — writes every event to KV in real time
  const emit = async (event: TraceEvent): Promise<void> => {
    await appendEvent(kv, evalId, event);

    // Keep session.status in sync so GET /evals/:id reflects live progress
    if (event.type === "status_change") {
      await patchSession(kv, evalId, {
        status: event.status satisfies EvalStatus,
      });
    }
  };

  try {
    const agent = new AuditorAgent(config, apiKey, emit);
    const finalState = await agent.run();

    // Write final state to KV
    await kv.put(
      `session:${evalId}`,
      JSON.stringify({ ...JSON.parse(raw), ...finalState }),
      { expirationTtl: SESSION_TTL },
    );

    // Persist to D1
    await persistResult(env.DB, finalState);
  } catch (err) {
    console.error(`[runner] eval ${evalId} crashed:`, err);
    await patchSession(kv, evalId, { status: "failed" });
    await appendEvent(kv, evalId, {
      type: "status_change",
      status: "failed",
      message: err instanceof Error ? err.message : String(err),
    } as TraceEvent);
  }
  } catch (outerErr) {
    console.error(`[runner] fatal error in eval ${evalId}:`, outerErr);
    try {
      await patchSession(kv, evalId, { status: "failed" });
      await appendEvent(kv, evalId, {
        type: "status_change",
        status: "failed",
        message: outerErr instanceof Error ? outerErr.message : String(outerErr),
      } as TraceEvent);
    } catch (e) {
      console.error(`[runner] failed to write error event:`, e);
    }
  }
}
