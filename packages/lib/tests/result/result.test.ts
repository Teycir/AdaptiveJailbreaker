import { describe, it, expect } from "vitest";
import { ok, err, unwrap, mapOk, tryAsync } from "../../src/result/index.ts";

describe("ok", () => {
  it("sets ok: true and wraps value", () => {
    const r = ok(42);
    expect(r).toEqual({ ok: true, value: 42 });
  });
});

describe("err", () => {
  it("sets ok: false and wraps error", () => {
    const r = err({ kind: "state_error", message: "bad" } as const);
    expect(r.ok).toBe(false);
    expect(r.error.kind).toBe("state_error");
  });
});

describe("unwrap", () => {
  it("returns value on Ok", () => {
    expect(unwrap(ok("hello"))).toBe("hello");
  });

  it("throws on Err", () => {
    expect(() =>
      unwrap(err({ kind: "config_error", message: "missing key" })),
    ).toThrow("[config_error] missing key");
  });
});

describe("mapOk", () => {
  it("transforms the Ok value", () => {
    expect(mapOk(ok(2), (n) => n * 3)).toEqual(ok(6));
  });

  it("passes Err through unchanged", () => {
    const e = err({ kind: "score_error", message: "bad" } as const);
    expect(mapOk(e, (n: number) => n * 3)).toEqual(e);
  });
});

describe("tryAsync", () => {
  it("returns Ok when fn resolves", async () => {
    const r = await tryAsync(
      () => Promise.resolve("done"),
      (c) => ({ kind: "unknown_error" as const, message: String(c) }),
    );
    expect(r).toEqual(ok("done"));
  });

  it("returns Err when fn rejects", async () => {
    const r = await tryAsync(
      () => Promise.reject(new Error("boom")),
      (c) => ({ kind: "network_error" as const, message: String(c), cause: c }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("network_error");
  });
});
