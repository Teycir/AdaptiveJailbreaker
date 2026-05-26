// workers/api/src/index.ts — Hono entry point

import { Hono } from "hono";
import { cors } from "hono/cors";
import { evalsRouter } from "./routes/evals.ts";
import { streamRouter } from "./routes/stream.ts";
import { resultsRouter, internalRouter } from "./routes/results.ts";
import { keyStatusRouter } from "./routes/keyStatus.ts";
import type { Env } from "./types.ts";

const app = new Hono<{ Bindings: Env }>();

// ── Global middleware ──────────────────────────────────────────────────────────

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "x-api-key", "x-openrouter-key", "x-internal-secret"],
  }),
);

// ── Health ─────────────────────────────────────────────────────────────────────

app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

// ── Routes ─────────────────────────────────────────────────────────────────────

app.route("/evals", evalsRouter);
app.route("/evals", streamRouter);      // WebSocket: /evals/:id/ws
app.route("/results", resultsRouter);
app.route("/key-status", keyStatusRouter);
app.route("/internal", internalRouter);

// ── 404 fallback ───────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: "not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal server error" }, 500);
});

export default app;
