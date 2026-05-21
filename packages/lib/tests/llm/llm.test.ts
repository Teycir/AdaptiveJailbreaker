import { describe, it, expect, vi, beforeEach } from "vitest";
import { callLLM } from "../../src/llm/index.ts";
import type { LLMRequest } from "@ajar/types";

const BASE_REQ: LLMRequest = {
  model: "meta-llama/llama-3.1-8b-instruct:free",
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

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("callLLM", () => {
  it("returns Ok with parsed response on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(VALID_RESPONSE),
      }),
    );

    const r = await callLLM(BASE_REQ, "sk-test");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.content).toBe("world");
      expect(r.value.toolCalls).toEqual([]);
      expect(r.value.promptTokens).toBe(10);
    }
  });

  it("returns Err with llm_error on non-ok HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve("rate limited"),
      }),
    );

    const r = await callLLM(BASE_REQ, "sk-test");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("llm_error");
  });

  it("returns Err with network_error when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const r = await callLLM(BASE_REQ, "sk-test");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("llm_error");
  });

  it("returns Err with parse_error when response has no choices", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ choices: [] }),
      }),
    );

    const r = await callLLM(BASE_REQ, "sk-test");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("parse_error");
  });

  it("parses tool_calls when present", async () => {
    const withTools = {
      ...VALID_RESPONSE,
      choices: [
        {
          message: {
            content: "",
            tool_calls: [
              { id: "c1", function: { name: "send_email", arguments: "{}" } },
            ],
          },
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(withTools),
      }),
    );

    const r = await callLLM(BASE_REQ, "sk-test");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.toolCalls).toHaveLength(1);
      expect(r.value.toolCalls[0].function.name).toBe("send_email");
    }
  });
});
