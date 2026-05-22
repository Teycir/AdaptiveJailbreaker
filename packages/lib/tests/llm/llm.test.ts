import { describe, it, expect, vi, beforeEach } from "vitest";
import { callLLM } from "../../src/llm/index.ts";
import type { LLMRequest } from "@ajar/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

// A local/Ollama model reference
const OLLAMA_REQ: LLMRequest = {
  model: "local/gemma4:e4b",
  messages: [{ role: "user", content: "hello" }],
};

// A bare "ollama" sentinel model
const SENTINEL_REQ: LLMRequest = {
  model: "ollama",
  messages: [{ role: "user", content: "hello" }],
};

const VALID_RESPONSE = {
  choices: [
    {
      message: {
        content: "world",
        tool_calls: [],
      },
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
};

// Mock getLocalConfig so tests never need a real Ollama instance.
// The ollama baseUrl is http://localhost:11434/v1, and callLLM appends /chat/completions.
vi.mock("../../src/llm/local.ts", () => ({
  isLocalModel: (model: string) =>
    model === "ollama" || model.startsWith("local/") || model === "local",
  extractLocalModelName: (model: string) =>
    model.startsWith("local/") ? model.slice("local/".length) : undefined,
  getLocalConfig: vi.fn().mockResolvedValue({
    provider: "ollama",
    baseUrl: "http://localhost:11434/v1",
    model: "gemma4:e4b",
  }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── callLLM — Ollama routing ──────────────────────────────────────────────────

describe("callLLM — Ollama routing", () => {
  it("routes local/ model to Ollama endpoint", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_RESPONSE),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const r = await callLLM(OLLAMA_REQ, "ollama");
    expect(r.ok).toBe(true);

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe("http://localhost:11434/v1/chat/completions");
  });

  it("routes 'ollama' sentinel model to Ollama endpoint", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_RESPONSE),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const r = await callLLM(SENTINEL_REQ, "ollama");
    expect(r.ok).toBe(true);

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe("http://localhost:11434/v1/chat/completions");
  });

  it("does NOT send an Authorization header to Ollama", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_RESPONSE),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await callLLM(OLLAMA_REQ, "ollama");

    const headers = fetchSpy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("returns Ok with parsed content on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_RESPONSE),
    }));

    const r = await callLLM(OLLAMA_REQ, "ollama");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.content).toBe("world");
      expect(r.value.promptTokens).toBe(10);
      expect(r.value.completionTokens).toBe(5);
      expect(r.value.toolCalls).toEqual([]);
    }
  });

  it("returns Err with llm_error on non-ok HTTP from Ollama", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("internal server error"),
    }));

    const r = await callLLM(OLLAMA_REQ, "ollama");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("llm_error");
  });

  it("returns Err with llm_error when fetch throws (Ollama offline)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const r = await callLLM(OLLAMA_REQ, "ollama");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("llm_error");
      expect(r.error.message).toMatch(/ECONNREFUSED|Unknown LLM error/);
    }
  });

  it("returns Err with parse_error when Ollama returns empty choices", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [] }),
    }));

    const r = await callLLM(OLLAMA_REQ, "ollama");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("parse_error");
  });

  it("parses tool_calls from Ollama response", async () => {
    const withTools = {
      ...VALID_RESPONSE,
      choices: [{
        message: {
          content: "",
          tool_calls: [
            { id: "c1", function: { name: "send_email", arguments: "{}" } },
          ],
        },
      }],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(withTools),
    }));

    const r = await callLLM(OLLAMA_REQ, "ollama");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.toolCalls).toHaveLength(1);
      expect(r.value.toolCalls[0]!.function.name).toBe("send_email");
    }
  });
});

// ── callLLM — Ollama offline (getLocalConfig returns null) ────────────────────

describe("callLLM — Ollama unavailable", () => {
  it("returns llm_error with helpful message when no local provider is detected", async () => {
    const { getLocalConfig } = await import("../../src/llm/local.ts");
    vi.mocked(getLocalConfig).mockResolvedValueOnce(null);

    const r = await callLLM(OLLAMA_REQ, "ollama");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("llm_error");
      expect(r.error.message).toMatch(/ollama serve/i);
    }
  });
});
