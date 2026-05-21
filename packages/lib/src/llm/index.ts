import type { LLMRequest, LLMResponse, ToolCall } from "@ajar/types";
import { type Result, ok, err, tryAsync } from "../result/index.ts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_REFERER = "https://ajar.pages.dev";
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000; // 1 s → 2 s → 4 s

// ── Request builder ───────────────────────────────────────────────────────────

function buildRequestBody(req: LLMRequest): Record<string, unknown> {
  return {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.9,
    max_tokens: req.maxTokens ?? 1024,
    ...(req.tools && req.tools.length > 0 ? { tools: req.tools } : {}),
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
      message: "No choices in OpenRouter response",
      raw: JSON.stringify(data),
    });
  }

  const choice = choices[0] as Record<string, unknown>;
  const message = choice["message"] as Record<string, unknown>;
  const usage = d["usage"] as Record<string, unknown> | undefined;
  const rawTools = message["tool_calls"];

  return ok({
    content: String(message["content"] ?? ""),
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
): Promise<Result<unknown>> {
  let lastError: ReturnType<typeof err> | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
    }

    const result = await tryAsync(
      async () => {
        const res = await fetch(OPENROUTER_URL, {
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
  const rawResult = await fetchCompletion(buildRequestBody(req), buildHeaders(apiKey));
  if (!rawResult.ok) return rawResult;
  return parseResponse(rawResult.value);
}
