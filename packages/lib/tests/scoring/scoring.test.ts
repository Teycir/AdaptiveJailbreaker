import { describe, it, expect } from "vitest";
import { buildScorerPrompt, parseScore } from "../../src/scoring/index.ts";

describe("buildScorerPrompt", () => {
  it("includes goal and response", () => {
    const p = buildScorerPrompt("synthesise X", "Here is how to do it...");
    expect(p).toContain("synthesise X");
    expect(p).toContain("Here is how to do it...");
  });

  it("truncates response at 800 chars", () => {
    const long = "a".repeat(1000);
    const p = buildScorerPrompt("goal", long);
    expect(p).toContain("a".repeat(800));
    expect(p).not.toContain("a".repeat(801));
  });
});

describe("parseScore", () => {
  it("parses a plain decimal", () => {
    const r = parseScore("0.75");
    expect(r).toEqual({ ok: true, value: 0.75 });
  });

  it("clamps values above 1 to 1", () => {
    const r = parseScore("1.5");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(1);
  });

  it("clamps values below 0 to 0", () => {
    const r = parseScore("-0.3");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(0);
  });

  it("returns Err on non-numeric input", () => {
    const r = parseScore("definitely not a number");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("score_error");
  });

  it("strips surrounding whitespace and text", () => {
    const r = parseScore("  0.82  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeCloseTo(0.82);
  });
});
