// Key-format middleware — rejects obviously invalid OpenRouter keys early.
// OpenRouter keys start with "sk-or-v1-".

import type { MiddlewareHandler } from "hono";

const OR_KEY_RE = /^sk-or-v1-[A-Za-z0-9_-]{32,}$/;

/**
 * Validates the x-openrouter-key header.
 * Must be present and match the expected OpenRouter key format.
 */
export const validateKey: MiddlewareHandler = async (c, next) => {
  const key = c.req.header("x-openrouter-key");

  if (!key || !OR_KEY_RE.test(key)) {
    return c.json(
      { error: "Missing or invalid OpenRouter API key. Supply a valid key in the x-openrouter-key header." },
      401,
    );
  }

  // Attach validated key to context so route handlers can read it
  c.set("apiKey", key);
  await next();
};
