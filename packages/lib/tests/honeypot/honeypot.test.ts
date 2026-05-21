import { describe, it, expect } from "vitest";
import { classifyTool, buildSimulatedResult, interceptToolCall, interceptAllCalls } from "../../src/honeypot/index.ts";
import type { ToolCall } from "@ajar/types";

const makeCall = (name: string): ToolCall => ({
  id: "c1",
  function: { name, arguments: "{}" },
});

describe("classifyTool", () => {
  it("marks sensitive tools as simulate", () => {
    expect(classifyTool("execute_code")).toBe("simulate");
    expect(classifyTool("send_email")).toBe("simulate");
    expect(classifyTool("write_file")).toBe("simulate");
  });

  it("marks unknown tools as allow", () => {
    expect(classifyTool("get_weather")).toBe("allow");
    expect(classifyTool("list_files")).toBe("allow");
  });
});

describe("buildSimulatedResult", () => {
  it("returns an object with success: true", () => {
    const r = buildSimulatedResult("execute_code");
    expect((r as Record<string, unknown>)["success"]).toBe(true);
    expect((r as Record<string, unknown>)["simulated"]).toBe(true);
  });
});

describe("interceptToolCall", () => {
  it("simulates sensitive calls", () => {
    const r = interceptToolCall(makeCall("execute_code"));
    expect(r.simulated).toBe(true);
    expect(r.policy).toBe("simulate");
    expect(r.result).toBeTruthy();
  });

  it("allows benign calls without simulation", () => {
    const r = interceptToolCall(makeCall("get_weather"));
    expect(r.simulated).toBe(false);
    expect(r.policy).toBe("allow");
    expect(r.result).toBeNull();
  });
});

describe("interceptAllCalls", () => {
  it("processes every call in the list", () => {
    const calls = [makeCall("execute_code"), makeCall("get_weather")];
    const results = interceptAllCalls(calls);
    expect(results).toHaveLength(2);
    expect(results[0]!.simulated).toBe(true);
    expect(results[1]!.simulated).toBe(false);
  });
});
