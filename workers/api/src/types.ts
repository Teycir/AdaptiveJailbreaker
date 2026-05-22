// Shared Env interface for the Hono API worker.
// Must stay in sync with wrangler.toml bindings.

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  API_INTERNAL_SECRET: string;
  API_WORKER_URL: string;
  OPENROUTER_KEY: string;
}
