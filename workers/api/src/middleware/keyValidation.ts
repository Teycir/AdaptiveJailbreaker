// Key-format middleware — accepts OpenRouter keys OR local Ollama mode.
// OpenRouter keys start with "sk-or-v1-".
// Ollama mode is indicated by the sentinel value "ollama" (no key required).

import type { MiddlewareHandler } from "hono";

const OR_KEY_RE = /^sk-or-v1-[A-Za-z0-9_-]{32,}$/;
const OLLAMA_SENTINEL = "ollama";

/**
 * Validates the x-openrouter-key header.
 * Accepts either a valid OpenRouter key OR the sentinel "ollama" for local mode.
 */
export const validateKey: MiddlewareHandler = async (c, next) => {
  const key = c.req.header("x-openrouter-key") ?? "";

  if (key !== OLLAMA_SENTINEL && !OR_KEY_RE.test(key)) {
    return c.json(
      {
        error:
          'Missing or invalid key. Supply a valid OpenRouter key (sk-or-v1-…) ' +
          'or "ollama" in the x-openrouter-key header to use a local Ollama model.',
      },
      401,
    );
  }

  // Attach validated key to context so route handlers can read it
  c.set("apiKey", key);
  await next();
};
