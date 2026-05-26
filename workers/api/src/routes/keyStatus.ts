// GET /key-status — probes the Gemini key pool and returns per-key health.
// Used by the frontend to show warnings without requiring user input.

import { Hono } from "hono";
import type { Env } from "../types.ts";
import { parseKeyPool } from "@ajar/lib";

export const keyStatusRouter = new Hono<{ Bindings: Env }>();

type KeyHealth = {
  index: number;
  prefix: string;
  status: "ok" | "rate_limited" | "invalid" | "error";
  message?: string;
  retryAfterSecs?: number;
};

type StatusResponse = {
  configured: boolean;
  poolSize: number;
  usableKeys: number;
  keys: KeyHealth[];
  warning?: string;
};

async function probeKey(key: string, index: number): Promise<KeyHealth> {
  const prefix = key.slice(0, 12);
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.5-flash-lite",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(8000),
      },
    );

    if (res.ok) return { index, prefix, status: "ok" };

    const body = await res.json().catch(() => ({})) as { error?: { code?: number; message?: string; status?: string } };
    const err = Array.isArray(body)
      ? (body[0] as { error?: { code?: number; message?: string; status?: string } })?.error
      : body?.error;
    const msg = err?.message ?? `HTTP ${res.status}`;
    const code = err?.code ?? res.status;

    if (code === 429 || err?.status === "RESOURCE_EXHAUSTED") {
      const retryMatch = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
      const retryAfterSecs = retryMatch ? Math.ceil(parseFloat(retryMatch[1]!)) : undefined;
      const isDaily = msg.toLowerCase().includes("day");
      return {
        index, prefix, status: "rate_limited",
        message: isDaily ? "Daily quota exhausted — resets at midnight UTC" : "Per-minute quota hit",
        retryAfterSecs,
      };
    }
    if (code === 401 || code === 403)
      return { index, prefix, status: "invalid", message: "Invalid or revoked API key" };
    return { index, prefix, status: "error", message: msg.slice(0, 120) };
  } catch (e) {
    return { index, prefix, status: "error", message: String(e).slice(0, 80) };
  }
}

keyStatusRouter.get("/", async (c) => {
  if (!c.env.GEMINI_API_KEYS?.trim()) {
    return c.json({
      configured: false, poolSize: 0, usableKeys: 0, keys: [],
      warning: "No API keys configured. Run: wrangler secret put GEMINI_API_KEYS",
    } satisfies StatusResponse, 503);
  }

  const pool = parseKeyPool(c.env.GEMINI_API_KEYS);
  const results = await Promise.all(pool.map((k, i) => probeKey(k, i)));
  const usableKeys = results.filter((r) => r.status === "ok").length;

  let warning: string | undefined;
  if (usableKeys === 0) {
    warning = results.every(r => r.status === "rate_limited")
      ? "All keys are rate-limited or quota-exhausted. Evals will fail until quotas reset."
      : "No usable keys found. Check key validity.";
  } else if (usableKeys < pool.length) {
    warning = `${pool.length - usableKeys} of ${pool.length} keys are rate-limited or invalid.`;
  }

  return c.json(
    { configured: true, poolSize: pool.length, usableKeys, keys: results, warning } satisfies StatusResponse,
    usableKeys === 0 ? 503 : 200,
  );
});
