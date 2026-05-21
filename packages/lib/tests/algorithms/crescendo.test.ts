import { describe, it, expect } from "vitest";
import { buildPlanPrompt, buildNextPrompt, buildRevisePrompt, parsePlan, stepIndex } from "../../src/algorithms/crescendo/index.ts";
import type { Message } from "@ajar/types";

const msgs = (n: number): Message[] =>
  Array.from({ length: n }, (_, i) => ({ role: "user" as const, content: `m${i}` }));

describe("buildPlanPrompt", () => {
  it("includes the goal", () => {
    expect(buildPlanPrompt("synthesize X")).toContain("synthesize X");
  });
  it("asks for JSON with steps key", () => {
    expect(buildPlanPrompt("g")).toContain('"steps"');
  });
});

describe("buildNextPrompt", () => {
  it("includes step number and goal", () => {
    const p = buildNextPrompt("goal", 2, []);
    expect(p).toContain("step: 3/5");
    expect(p).toContain("goal");
  });
  it("includes recent message content", () => {
    const p = buildNextPrompt("goal", 0, [{ role: "user", content: "hello" }]);
    expect(p).toContain("hello");
  });
});

describe("buildRevisePrompt", () => {
  it("includes the goal", () => {
    expect(buildRevisePrompt("goal X")).toContain("goal X");
  });
});

describe("parsePlan", () => {
  it("parses valid JSON with steps", () => {
    const r = parsePlan(JSON.stringify({ steps: ["a", "b", "c"] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(["a", "b", "c"]);
  });

  it("returns Err on invalid JSON", () => {
    const r = parsePlan("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("parse_error");
  });

  it("returns Err on empty steps array", () => {
    const r = parsePlan(JSON.stringify({ steps: [] }));
    expect(r.ok).toBe(false);
  });
});

describe("stepIndex", () => {
  it("returns 0 for empty messages", () => {
    expect(stepIndex({ messages: [] })).toBe(0);
  });
  it("returns 4 at max regardless of message count", () => {
    expect(stepIndex({ messages: msgs(20) })).toBe(4);
  });
  it("increments every 2 messages", () => {
    expect(stepIndex({ messages: msgs(4) })).toBe(2);
  });
});
