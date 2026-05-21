// Shared Env interface for the Hono API worker.
// Must stay in sync with wrangler.toml bindings.

export interface Env {
  DB: D1Database;
  TRANSCRIPTS: R2Bucket;
  EVAL_SESSION: DurableObjectNamespace;
  /** Shared secret between the API worker and the DO for /internal/results */
  API_INTERNAL_SECRET: string;
  /** Full URL of this API worker; used by EvalSession DO for the D1 callback.
   *  Set in wrangler.toml [vars] — required for D1 persistence to run. */
  API_WORKER_URL: string;
}
