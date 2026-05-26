// Key validation middleware.
// All LLM calls use Gemini. Keys are stored server-side as the GEMINI_API_KEYS
// wrangler secret (comma-separated pool). This middleware is kept as a thin
// pass-through for internal route protection; actual key injection happens in
// the engine worker via the secret binding, not from client headers.
//
// Supported key formats (server-side only):
//   Gemini  →  AIza<35+ alphanum>
//   Ollama  →  the literal string "ollama" (local dev only)

import type { MiddlewareHandler } from "hono";

const GEMINI_KEY_RE  = /^AIza[A-Za-z0-9_-]{35,}$/;
const OLLAMA_SENTINEL = "ollama";

type KeyKind = "gemini" | "ollama";

function classifyKey(k: string): KeyKind | null {
  if (k === OLLAMA_SENTINEL)   return "ollama";
  if (GEMINI_KEY_RE.test(k))   return "gemini";
  return null;
}

export const validateKey: MiddlewareHandler = async (c, next) => {
  const raw = c.req.header("x-api-key") ?? "";

  if (!raw) {
    return c.json({ error: "Missing x-api-key header." }, 401);
  }

  const keys = raw.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) {
    return c.json({ error: "x-api-key header is empty." }, 401);
  }

  const kinds = keys.map(classifyKey);
  const invalid = kinds.findIndex((k) => k === null);
  if (invalid !== -1) {
    return c.json(
      { error: `Key #${invalid + 1} is invalid. Expected a Gemini key (AIza…) or "ollama".` },
      401,
    );
  }

  const uniqueKinds = new Set(kinds as KeyKind[]);
  if (uniqueKinds.has("ollama") && keys.length > 1) {
    return c.json({ error: '"ollama" cannot be combined with other keys.' }, 401);
  }
  if (uniqueKinds.size > 1) {
    return c.json({ error: "All keys in the pool must be Gemini keys." }, 401);
  }

  c.set("apiKey", keys.join(","));
  await next();
};
