import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  callLLM,
  parseKeyPool,
  isGeminiKey,
  isGeminiModel,
  stripGeminiPrefix,
} from "../../src/llm/index.ts";
import type { LLMRequest } from "@ajar/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GEMINI_KEY_A = "AIzaFakeKeyAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const GEMINI_KEY_B = "AIzaFakeKeyBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const GEMINI_KEY_C = "AIzaFakeKeyCCCCCCCCCCCCCCCCCCCCCCCCCCC";

const GEMINI_REQ: LLMRequest = {
  model: "gemini/gemini-2.0-flash",
  messages: [{ role: "user", content: "hello" }],
};

const VALID_RESPONSE = {
  choices: [
    {
      message: { content: "Hello from Gemini!", tool_calls: [] },
    },
  ],
  usage: { prompt_tokens: 8, completion_tokens: 5 },
};

const RATE_LIMIT_RESPONSE = {
  ok: false,
  status: 429,
  text: () => Promise.resolve("rate limit exceeded"),
};

const AUTH_ERROR_RESPONSE = {
  ok: false,
  status: 401,
  text: () => Promise.resolve("invalid api key"),
};

// Mock local.ts so Gemini tests never accidentally route to Ollama
vi.mock("../../src/llm/local.ts", () => ({
  isLocalModel: (_model: string) => false,
  extractLocalModelName: (_model: string) => undefined,
  getLocalConfig: vi.fn().mockResolvedValue(null),
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── Helper utilities ──────────────────────────────────────────────────────────

describe("parseKeyPool", () => {
  it("parses a single key", () => {
    expect(parseKeyPool(GEMINI_KEY_A)).toEqual([GEMINI_KEY_A]);
  });

  it("parses comma-separated keys", () => {
    expect(parseKeyPool(`${GEMINI_KEY_A},${GEMINI_KEY_B}`)).toEqual([
      GEMINI_KEY_A,
      GEMINI_KEY_B,
    ]);
  });

  it("trims spaces around keys", () => {
    expect(parseKeyPool(` ${GEMINI_KEY_A} , ${GEMINI_KEY_B} `)).toEqual([
      GEMINI_KEY_A,
      GEMINI_KEY_B,
    ]);
  });

  it("deduplicates identical keys", () => {
    expect(parseKeyPool(`${GEMINI_KEY_A},${GEMINI_KEY_A}`)).toEqual([GEMINI_KEY_A]);
  });

  it("ignores empty segments", () => {
    expect(parseKeyPool(`${GEMINI_KEY_A},,${GEMINI_KEY_B}`)).toEqual([
      GEMINI_KEY_A,
      GEMINI_KEY_B,
    ]);
  });

  it("handles 3-key pool", () => {
    const pool = parseKeyPool(`${GEMINI_KEY_A},${GEMINI_KEY_B},${GEMINI_KEY_C}`);
    expect(pool).toHaveLength(3);
    expect(pool).toEqual([GEMINI_KEY_A, GEMINI_KEY_B, GEMINI_KEY_C]);
  });
});

describe("isGeminiKey / isGeminiModel / stripGeminiPrefix", () => {
  it("detects AIza… keys as Gemini", () => {
    expect(isGeminiKey(GEMINI_KEY_A)).toBe(true);
    expect(isGeminiKey("sk-not-a-gemini-key")).toBe(false);
  });

  it("detects gemini/ prefixed models", () => {
    expect(isGeminiModel("gemini/gemini-2.0-flash")).toBe(true);
    expect(isGeminiModel("openai/gpt-4o")).toBe(false);
  });

  it("strips the gemini/ prefix from model names", () => {
    expect(stripGeminiPrefix("gemini/gemini-2.0-flash")).toBe("gemini-2.0-flash");
    expect(stripGeminiPrefix("gemini-2.0-flash")).toBe("gemini-2.0-flash");
  });
});

// ── callLLM — Gemini routing ──────────────────────────────────────────────────

describe("callLLM — Gemini single key, happy path", () => {
  it("routes gemini/ model to Gemini OpenAI-compat endpoint", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_RESPONSE),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const r = await callLLM(GEMINI_REQ, GEMINI_KEY_A);
    expect(r.ok).toBe(true);

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("generativelanguage.googleapis.com");
  });

  it("strips gemini/ prefix from model name in the request body", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_RESPONSE),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await callLLM(GEMINI_REQ, GEMINI_KEY_A);

    const body = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string);
    expect(body.model).toBe("gemini-2.0-flash");
    expect(body.model).not.toContain("gemini/");
  });

  it("uses Bearer auth header with the Gemini key", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_RESPONSE),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await callLLM(GEMINI_REQ, GEMINI_KEY_A);

    const headers = fetchSpy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${GEMINI_KEY_A}`);
  });

  it("returns parsed content and token counts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_RESPONSE),
    }));

    const r = await callLLM(GEMINI_REQ, GEMINI_KEY_A);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.content).toBe("Hello from Gemini!");
      expect(r.value.promptTokens).toBe(8);
      expect(r.value.completionTokens).toBe(5);
      expect(r.value.toolCalls).toEqual([]);
    }
  });
});

// ── callLLM — Gemini key rotation on 429 ─────────────────────────────────────

describe("callLLM — Gemini multi-key rotation", () => {
  it("falls through to key B when key A is rate-limited", async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(RATE_LIMIT_RESPONSE) // key A → 429
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(VALID_RESPONSE) }); // key B → ok

    vi.stubGlobal("fetch", fetchSpy);

    const r = await callLLM(GEMINI_REQ, `${GEMINI_KEY_A},${GEMINI_KEY_B}`);
    expect(r.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Second call should use key B
    const headersB = fetchSpy.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(headersB["Authorization"]).toBe(`Bearer ${GEMINI_KEY_B}`);
  });

  it("succeeds on key C after A and B are both rate-limited", async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(RATE_LIMIT_RESPONSE) // key A → 429
      .mockResolvedValueOnce(RATE_LIMIT_RESPONSE) // key B → 429
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(VALID_RESPONSE) }); // key C → ok

    vi.stubGlobal("fetch", fetchSpy);

    const r = await callLLM(GEMINI_REQ, `${GEMINI_KEY_A},${GEMINI_KEY_B},${GEMINI_KEY_C}`);
    expect(r.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    const headersC = fetchSpy.mock.calls[2]?.[1]?.headers as Record<string, string>;
    expect(headersC["Authorization"]).toBe(`Bearer ${GEMINI_KEY_C}`);
  });

  it("does NOT rotate on a non-429 error (auth failure stops immediately)", async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(AUTH_ERROR_RESPONSE) // key A → 401
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(VALID_RESPONSE) }); // never reached

    vi.stubGlobal("fetch", fetchSpy);

    const r = await callLLM(GEMINI_REQ, `${GEMINI_KEY_A},${GEMINI_KEY_B}`);
    expect(r.ok).toBe(false);
    // Should have stopped at key A — key B never tried
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns Err after all keys are exhausted across all rounds", async () => {
    // Every key returns 429 every time → should exhaust MAX_ROUNDS
    const fetchSpy = vi.fn().mockResolvedValue(RATE_LIMIT_RESPONSE);
    vi.stubGlobal("fetch", fetchSpy);

    const r = await callLLM(GEMINI_REQ, `${GEMINI_KEY_A},${GEMINI_KEY_B}`);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("llm_error");
      expect(r.error.message).toMatch(/rate.limit|all keys/i);
    }
    // 2 keys × 3 rounds = 6 total fetch calls
    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });

  it("deduplicates keys — duplicate key is only called once per round", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(RATE_LIMIT_RESPONSE);
    vi.stubGlobal("fetch", fetchSpy);

    // A appears twice — parseKeyPool deduplicates, so pool is [A, B]
    const r = await callLLM(GEMINI_REQ, `${GEMINI_KEY_A},${GEMINI_KEY_A},${GEMINI_KEY_B}`);
    expect(r.ok).toBe(false);
    // 2 unique keys × 3 rounds = 6 (not 9)
    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });
});

// ── callLLM — Gemini key auto-detection via AIza prefix ──────────────────────

describe("callLLM — Gemini routing by key prefix (no gemini/ in model name)", () => {
  it("routes to Gemini endpoint when key starts with AIza, even for a plain model name", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(VALID_RESPONSE),
    });
    vi.stubGlobal("fetch", fetchSpy);

    // Model name has no gemini/ prefix but key is AIza*
    const r = await callLLM(
      { model: "gemini-2.0-flash", messages: [{ role: "user", content: "hi" }] },
      GEMINI_KEY_A,
    );
    expect(r.ok).toBe(true);
    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("generativelanguage.googleapis.com");
  });
});

// ── callLLM — parse errors ────────────────────────────────────────────────────

describe("callLLM — Gemini response parsing edge cases", () => {
  it("returns parse_error on empty choices array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [] }),
    }));

    const r = await callLLM(GEMINI_REQ, GEMINI_KEY_A);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("parse_error");
  });

  it("parses tool_calls from Gemini response correctly", async () => {
    const withTools = {
      choices: [{
        message: {
          content: "",
          tool_calls: [
            { id: "t1", function: { name: "search_web", arguments: '{"q":"test"}' } },
          ],
        },
      }],
      usage: { prompt_tokens: 10, completion_tokens: 2 },
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(withTools),
    }));

    const r = await callLLM(GEMINI_REQ, GEMINI_KEY_A);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.toolCalls).toHaveLength(1);
      expect(r.value.toolCalls[0]!.function.name).toBe("search_web");
      expect(r.value.toolCalls[0]!.function.arguments).toBe('{"q":"test"}');
    }
  });

  it("returns llm_error when fetch throws (network failure)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));

    const r = await callLLM(GEMINI_REQ, GEMINI_KEY_A);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("llm_error");
  });
});
