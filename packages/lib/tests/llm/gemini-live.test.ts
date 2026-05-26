/**
 * Live integration test — validates all 9 Gemini keys from .env
 * Run with: npx vitest run tests/llm/gemini-live.test.ts --reporter=verbose
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseKeyPool, callLLM } from "../../src/llm/index.ts";

// ── Load key pool from .env ───────────────────────────────────────────────────

function loadGeminiKeys(): { pool: string[]; accounts: string[] } {
  const envRaw = readFileSync("/home/teycir/Repos/AdaptiveJailbreaker/.env", "utf8");
  const keysLine = envRaw.split("\n").find((l) => l.startsWith("GEMINI_API_KEYS="));
  if (!keysLine) throw new Error("GEMINI_API_KEYS not found in .env");
  const pool = parseKeyPool(keysLine.replace("GEMINI_API_KEYS=", "").trim());
  const accounts = [
    "teycir", "teycitek", "bensoltaneteycir",
    "teycircoder", "teycircoder1", "teycircoder2",
    "teycircoder3", "teycircoder5", "teycirbensoltane",
  ];
  return { pool, accounts };
}

const { pool, accounts } = loadGeminiKeys();
const POOL_STRING = pool.join(",");

// ── Individual key tests ──────────────────────────────────────────────────────

describe("Gemini live — individual keys", () => {
  for (let i = 0; i < pool.length; i++) {
    const key = pool[i]!;
    const name = accounts[i] ?? `key-${i}`;

    it(`[${i + 1}/${pool.length}] ${name} (${key.slice(0, 12)}…) responds OK`, async () => {
      const r = await callLLM(
        {
          model: "gemini/gemini-2.5-flash-lite",
          messages: [{ role: "user", content: "Reply with only the word: OK" }],
        },
        key,
      );
      expect(r.ok, `Key ${name} failed: ${!r.ok ? (r as any).error?.message : ""}`).toBe(true);
      if (r.ok) {
        expect(r.value.content.length).toBeGreaterThan(0);
      }
    }, 15_000);
  }
});

// ── Full pool rotation test ───────────────────────────────────────────────────

describe("Gemini live — full pool rotation", () => {
  it("pool of 9 keys responds successfully (rotation entry point)", async () => {
    const r = await callLLM(
      {
        model: "gemini/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: "Reply with only the word: POOL_OK" }],
      },
      POOL_STRING,
    );
    expect(r.ok, `Pool call failed: ${!r.ok ? (r as any).error?.message : ""}`).toBe(true);
    if (r.ok) {
      expect(r.value.content.length).toBeGreaterThan(0);
      console.log(`  Pool response: "${r.value.content}"`);
    }
  }, 20_000);

  it("pool key count is 9 (no accidental duplicates)", () => {
    expect(pool).toHaveLength(9);
    const unique = new Set(pool);
    expect(unique.size).toBe(9);
  });

  it("all keys are valid Gemini AIza… format", () => {
    for (const key of pool) {
      expect(key.startsWith("AIza"), `Key ${key.slice(0, 12)} does not start with AIza`).toBe(true);
    }
  });
});
