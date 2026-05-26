import { describe, it, expect } from "vitest";
import type { EvalConfig } from "@ajar/types";
import {
  makeInitialState,
  addMessageToState,
  addScoreToState,
  rollbackState,
  setStatus,
  getCurrentBranch,
  isComplete,
  shouldRollback,
  scoreTrend,
  makeBranch,
  recordScore,
} from "../../src/state/index.ts";

const CONFIG: EvalConfig = {
  id: "test-run",
  algorithm: "crescendo",
  targetModel: "model-a",
  attackerModel: "model-b",
  scorerModel: "model-c",
  goal: "test goal",
  maxTurns: 10,
  maxRollbacks: 3,
  successThreshold: 0.85,
};

describe("makeInitialState", () => {
  it("creates a single branch at id 0", () => {
    const s = makeInitialState(CONFIG, "run-1");
    expect(s.branches).toHaveLength(1);
    expect(s.currentBranchId).toBe(0);
    expect(s.totalTurns).toBe(0);
    expect(s.status).toBe("running");
  });
});

describe("addMessageToState", () => {
  it("appends message and increments totalTurns", () => {
    const s = makeInitialState(CONFIG, "run-1");
    const s2 = addMessageToState(s, { role: "user", content: "hi" });
    expect(s2.totalTurns).toBe(1);
    expect(s2.branches[0]!.messages).toHaveLength(1);
  });

  it("does not mutate the original state", () => {
    const s = makeInitialState(CONFIG, "run-1");
    addMessageToState(s, { role: "user", content: "hi" });
    expect(s.totalTurns).toBe(0);
  });
});

describe("addScoreToState", () => {
  it("appends score to current branch", () => {
    const s = addScoreToState(makeInitialState(CONFIG, "run-1"), 0.7);
    expect(s.branches[0]!.scores).toEqual([0.7]);
  });
});

describe("rollbackState", () => {
  it("creates a new branch and increments rollback count", () => {
    let s = makeInitialState(CONFIG, "run-1");
    for (let i = 0; i < 6; i++) {
      s = addMessageToState(s, { role: "user", content: `msg${i}` });
    }
    const r = rollbackState(s);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.totalRollbacks).toBe(1);
      expect(r.value.branches).toHaveLength(2);
      expect(r.value.branches[0]!.rolledBack).toBe(true);
    }
  });

  it("returns Err when max rollbacks is reached", () => {
    let s = makeInitialState({ ...CONFIG, maxRollbacks: 0 }, "run-1");
    s = addMessageToState(s, { role: "user", content: "msg" });
    const r = rollbackState(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("state_error");
  });
});

describe("isComplete", () => {
  it("returns false when running and under maxTurns", () => {
    expect(isComplete(makeInitialState(CONFIG, "run-1"))).toBe(false);
  });

  it("returns true when status is success", () => {
    const s = setStatus(makeInitialState(CONFIG, "run-1"), "success");
    expect(isComplete(s)).toBe(true);
  });

  it("returns true when totalTurns reaches maxTurns", () => {
    let s = makeInitialState(CONFIG, "run-1");
    for (let i = 0; i < 10; i++) {
      s = addMessageToState(s, { role: "user", content: "m" });
    }
    expect(isComplete(s)).toBe(true);
  });
});

describe("shouldRollback", () => {
  it("returns false when not enough scores", () => {
    const b = recordScore(recordScore(makeBranch(0, null), 0.5), 0.4);
    expect(shouldRollback(b)).toBe(false);
  });

  it("returns true when score is declining", () => {
    let b = makeBranch(0, null);
    for (const s of [0.8, 0.6, 0.3]) b = recordScore(b, s);
    expect(shouldRollback(b)).toBe(true);
  });

  it("returns false when latest score is at or above successThreshold even if declining", () => {
    let b = makeBranch(0, null);
    // All three scores are above the 0.85 threshold — latest is 0.86, so guard fires
    for (const s of [0.92, 0.89, 0.86]) b = recordScore(b, s);
    expect(shouldRollback(b, 0.85)).toBe(false);
  });
});

describe("getCurrentBranch", () => {
  it("returns Ok with branch 0 on fresh state", () => {
    const s = makeInitialState(CONFIG, "run-1");
    const r = getCurrentBranch(s);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.id).toBe(0);
  });
});
