import type { EvalConfig, EvalState, TraceEvent } from "@ajar/types";
import { AuditorAgent } from "./AuditorAgent.ts";

// ── Env bindings (declared in wrangler.toml) ──────────────────────────────────

export interface Env {
  DB: D1Database;
  EVAL_SESSION: DurableObjectNamespace;
  /** Shared secret used to authenticate DO → Worker /internal/results calls */
  API_INTERNAL_SECRET: string;
  /** Full URL of the API worker, used for the D1 persistence callback */
  API_WORKER_URL: string;
}

// ── Durable Object ────────────────────────────────────────────────────────────

export class EvalSession implements DurableObject {
  private readonly storage: DurableObjectStorage;
  private readonly env: Env;
  private readonly connections: Set<WebSocket> = new Set();
  private evalState: EvalState | null = null;
  private running = false;

  constructor(state: DurableObjectState, env: Env) {
    this.storage = state.storage;
    this.env = env;
    // Fix #12: restore the running flag from durable storage so a cold-started DO
    // rejects duplicate POST /start requests even after an eviction mid-eval.
    state.blockConcurrencyWhile(async () => {
      this.running = (await this.storage.get<boolean>("running")) ?? false;
    });
  }

  // ── Request dispatch ──────────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket();
    }

    if (url.pathname.endsWith("/start") && request.method === "POST") {
      return this.handleStart(request);
    }

    if (url.pathname.endsWith("/status") && request.method === "GET") {
      return new Response(JSON.stringify(this.evalState), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────

  private handleWebSocket(): Response {
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    this.connections.add(server);

    server.addEventListener("close", () => this.connections.delete(server));
    server.addEventListener("error", () => this.connections.delete(server));

    if (this.evalState) {
      try {
        const snap: TraceEvent = { type: "snapshot", state: this.evalState };
        server.send(JSON.stringify(snap));
      } catch {
        this.connections.delete(server);
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  // ── Start eval ────────────────────────────────────────────────────────────

  private async handleStart(request: Request): Promise<Response> {
    if (this.running) {
      return new Response(JSON.stringify({ error: "already running" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: { config: EvalConfig; apiKey: string } = await request.json();
    // Fix #12: persist before firing so a concurrent request that arrives before
    // runEval sets this.running will also be rejected.
    await this.storage.put("running", true);
    this.running = true;

    this.runEval(body.config, body.apiKey).catch((err: unknown) => {
      this.broadcast({ type: "status_change", status: "failed", message: String(err) });
    });

    return new Response(JSON.stringify({ started: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Core eval loop ────────────────────────────────────────────────────────

  private async runEval(config: EvalConfig, apiKey: string): Promise<void> {
    const agent = new AuditorAgent(config, apiKey, (event) => this.broadcast(event));

    try {
      this.evalState = await agent.run();
    } catch (err) {
      this.broadcast({ type: "status_change", status: "failed", message: String(err) });
      return;
    } finally {
      // Fix #12: clear the persisted flag so a completed (or crashed) eval session
      // does not permanently block a re-run in the same DO instance.
      this.running = false;
      await this.storage.delete("running");
    }

    await this.storage.put("finalState", JSON.stringify(this.evalState));
    await this.persistToD1(this.evalState);
  }

  // ── D1 persistence callback ───────────────────────────────────────────────

  private async persistToD1(state: EvalState): Promise<void> {
    const url = `${this.env.API_WORKER_URL}/internal/results`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": this.env.API_INTERNAL_SECRET,
        },
        body: JSON.stringify({ state }),
      });
      if (!res.ok) {
        console.error(`[EvalSession] D1 persist failed: ${res.status} ${await res.text()}`);
      }
    } catch (err) {
      console.error("[EvalSession] D1 persist error:", err);
    }
  }

  // ── Fan-out broadcast ─────────────────────────────────────────────────────

  private broadcast(event: TraceEvent): void {
    const msg = JSON.stringify(event);
    for (const ws of this.connections) {
      try {
        ws.send(msg);
      } catch {
        this.connections.delete(ws);
      }
    }
  }
}
