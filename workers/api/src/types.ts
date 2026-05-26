// Shared Env interface for the Hono API worker.
// Must stay in sync with wrangler.toml bindings.

export interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  API_INTERNAL_SECRET: string;
  API_WORKER_URL: string;
  /** Comma-separated Gemini API key pool — set via: wrangler secret put GEMINI_API_KEYS */
  GEMINI_API_KEYS: string;
}
