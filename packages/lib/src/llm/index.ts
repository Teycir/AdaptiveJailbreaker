import type { LLMRequest, LLMResponse, ToolCall } from "@ajar/types";
import { type Result, ok, err, tryAsync } from "../result/index.ts";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const RETRY_BASE_MS = 1000;

// ── Provider detection ────────────────────────────────────────────────────────

export function isGeminiKey(key: string): boolean {
  return key.startsWith("AIza");
}
export function isGeminiModel(model: string): boolean {
  return model.startsWith("gemini/");
}
export function stripGeminiPrefix(model: string): string {
  return model.startsWith("gemini/") ? model.slice("gemini/".length) : model;
}
export function isLocalModel(model: string): boolean {
  return model === "ollama" || model.startsWith("local/") || model === "local";
}

// ── Key pool ──────────────────────────────────────────────────────────────────

export function parseKeyPool(raw: string): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const k of raw.split(",")) {
    const trimmed = k.trim();
    if (trimmed && !seen.has(trimmed)) { seen.add(trimmed); keys.push(trimmed); }
  }
  return keys;
}

// ── Request builder ───────────────────────────────────────────────────────────

function buildBody(req: LLMRequest): Record<string, unknown> {
  return {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.9,
    max_tokens: req.maxTokens ?? 1024,
    ...(req.tools && req.tools.length > 0 ? { tools: req.tools } : {}),
  };
}

function buildBodyLocal(req: LLMRequest): Record<string, unknown> {
  return { ...buildBody(req), ...(req.jsonMode ? { format: "json" } : {}) };
}

function geminiHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

// ── Response parser ───────────────────────────────────────────────────────────

function parseToolCalls(raw: unknown[]): ToolCall[] {
  return raw.map((tc) => {
    const t = tc as Record<string, unknown>;
    const fn = t["function"] as Record<string, unknown>;
    return { id: String(t["id"] ?? ""), function: { name: String(fn["name"] ?? ""), arguments: String(fn["arguments"] ?? "{}") } };
  });
}

function parseResponse(data: unknown): Result<LLMResponse> {
  const d = data as Record<string, unknown>;
  const choices = d["choices"];
  if (!Array.isArray(choices) || choices.length === 0)
    return err({ kind: "parse_error", message: "No choices in LLM response", raw: JSON.stringify(data) });
  const choice = choices[0] as Record<string, unknown>;
  const message = choice["message"] as Record<string, unknown>;
  const usage = d["usage"] as Record<string, unknown> | undefined;
  const rawTools = message["tool_calls"];
  return ok({
    content: String(message["content"] ?? "").trim(),
    toolCalls: Array.isArray(rawTools) ? parseToolCalls(rawTools) : [],
    promptTokens: Number(usage?.["prompt_tokens"] ?? 0),
    completionTokens: Number(usage?.["completion_tokens"] ?? 0),
  });
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchOnce(
  body: Record<string, unknown>,
  headers: Record<string, string>,
  url: string,
): Promise<Result<unknown>> {
  return tryAsync(
    async () => {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const text = await res.text().catch(() => "(unreadable)");
        throw Object.assign(new Error(text), { status: res.status });
      }
      return res.json();
    },
    (cause) => {
      const e = cause as { message?: string; status?: number };
      return { kind: "llm_error" as const, message: e.message ?? "Unknown LLM error", status: e.status };
    },
  );
}

// ── Key-rotating fetch (Gemini pool) ─────────────────────────────────────────
// Try each key in order. On 429, advance to the next immediately.
// If all keys 429 in one round, back off and retry up to MAX_ROUNDS times.

const MAX_ROUNDS = 3;

async function fetchWithRotation(
  body: Record<string, unknown>,
  keys: string[],
): Promise<Result<unknown>> {
  let lastError: ReturnType<typeof err> | null = null;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (round > 0) await sleep(RETRY_BASE_MS * 2 ** (round - 1));
    for (const key of keys) {
      const result = await fetchOnce(body, geminiHeaders(key), GEMINI_URL);
      if (result.ok) return result;
      const status = (result.error as { status?: number }).status;
      if (status === 429) { lastError = result; continue; }
      return result; // hard error — don't rotate
    }
  }
  return lastError ?? err({ kind: "llm_error", message: "All Gemini keys rate-limited after max retries" });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function callLLM(req: LLMRequest, apiKey: string): Promise<Result<LLMResponse>> {
  // ── Local / Ollama ─────────────────────────────────────────────────────────
  if (isLocalModel(req.model) || apiKey === "ollama") {
    const OLLAMA_URL = "http://localhost:11434/v1";
    const model = req.model.startsWith("local/") ? req.model.slice("local/".length) : req.model;
    const localReq = { ...req, model };
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
      const raw = await fetchOnce(buildBodyLocal(localReq), { "Content-Type": "application/json" }, `${OLLAMA_URL}/chat/completions`);
      if (!raw.ok) return raw;
      const parsed = parseResponse(raw.value);
      if (!parsed.ok) return parsed;
      if (parsed.value.content === "" && req.jsonMode) continue;
      return parsed;
    }
    return err({ kind: "llm_error", message: "Ollama returned empty content after retries" });
  }

  // ── Gemini (key pool with 429-rotation) ────────────────────────────────────
  const keys = parseKeyPool(apiKey);
  const geminiReq = { ...req, model: stripGeminiPrefix(req.model) };
  const raw = await fetchWithRotation(buildBody(geminiReq), keys);
  if (!raw.ok) return raw;
  return parseResponse(raw.value);
}
