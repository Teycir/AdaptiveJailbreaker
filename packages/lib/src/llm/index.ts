import type { LLMRequest, LLMResponse, ToolCall } from "@ajar/types";
import { type Result, ok, err, tryAsync } from "../result/index.ts";
import { isLocalModel, getLocalConfig } from "./local.ts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_REFERER = "https://ajar.pages.dev";
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000; // 1 s → 2 s → 4 s

// ── Request builder ───────────────────────────────────────────────────────────

function buildRequestBody(req: LLMRequest, local = false): Record<string, unknown> {
  return {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.9,
    max_tokens: req.maxTokens ?? 1024,
    ...(req.tools && req.tools.length > 0 ? { tools: req.tools } : {}),
    // Ollama-specific: force JSON output when caller needs structured data
    ...(local && req.jsonMode ? { format: "json" } : {}),
  };
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": DEFAULT_REFERER,
  };
}

// ── Response parser ───────────────────────────────────────────────────────────

function parseToolCalls(raw: unknown[]): ToolCall[] {
  return raw.map((tc) => {
    const t = tc as Record<string, unknown>;
    const fn = t["function"] as Record<string, unknown>;
    return {
      id: String(t["id"] ?? ""),
      function: {
        name: String(fn["name"] ?? ""),
        arguments: String(fn["arguments"] ?? "{}"),
      },
    };
  });
}

function parseResponse(data: unknown): Result<LLMResponse> {
  const d = data as Record<string, unknown>;
  const choices = d["choices"];
  if (!Array.isArray(choices) || choices.length === 0) {
    return err({
      kind: "parse_error",
      message: "No choices in LLM response",
      raw: JSON.stringify(data),
    });
  }

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

// ── Retry helper ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── HTTP call (with exponential backoff on 429) ───────────────────────────────

async function fetchCompletion(
  body: Record<string, unknown>,
  headers: Record<string, string>,
  url: string = OPENROUTER_URL,
): Promise<Result<unknown>> {
  let lastError: ReturnType<typeof err> | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
    }

    const result = await tryAsync(
      async () => {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "(unreadable)");
          throw Object.assign(new Error(text), { status: res.status });
        }

        return res.json();
      },
      (cause) => {
        const e = cause as { message?: string; status?: number };
        return {
          kind: "llm_error" as const,
          message: e.message ?? "Unknown LLM error",
          status: e.status,
        };
      },
    );

    if (result.ok) return result;

    // Only retry on rate-limit (429) or server errors (5xx)
    const status = (result.error as { status?: number }).status;
    if (status !== 429 && (status === undefined || status < 500)) {
      return result; // non-retryable (4xx other than 429, parse errors, etc.)
    }

    lastError = result;
  }

  return lastError!;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function callLLM(
  req: LLMRequest,
  apiKey: string,
): Promise<Result<LLMResponse>> {
  // Check if using local model (apiKey === "ollama" also forces local routing)
  if (isLocalModel(req.model) || apiKey === "ollama") {
    const localConfig = await getLocalConfig(isLocalModel(req.model) ? req.model : undefined);
    if (!localConfig) {
      return err({
        kind: "llm_error",
        message:
          "Local model requested but no local provider (Ollama/LM Studio) detected. " +
          "Make sure Ollama is running: `ollama serve`",
      });
    }

    // Use local provider — model resolved by getLocalConfig
    const localReq = { ...req, model: localConfig.model };
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
      const rawResult = await fetchCompletion(
        buildRequestBody(localReq, true),
        { "Content-Type": "application/json" },
        `${localConfig.baseUrl}/chat/completions`,
      );
      if (!rawResult.ok) return rawResult;
      const parsed = parseResponse(rawResult.value);
      if (!parsed.ok) return parsed;
      // Retry empty content — Ollama sometimes returns blank on first inference
      if (parsed.value.content === "" && req.jsonMode) continue;
      return parsed;
    }
    return err({ kind: "llm_error", message: "Ollama returned empty content after retries" });
  }

  // Use OpenRouter
  const rawResult = await fetchCompletion(
    buildRequestBody(req, false),
    buildHeaders(apiKey),
    OPENROUTER_URL,
  );
  if (!rawResult.ok) return rawResult;
  return parseResponse(rawResult.value);
}
