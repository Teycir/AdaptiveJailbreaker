import type { Branch, EvalConfig, EvalState, EvalStatus, Message } from "@ajar/types";
import { type Result, ok, err } from "../result/index.ts";

// ── Branch helpers (pure) ─────────────────────────────────────────────────────

export function makeBranch(id: number, parentId: number | null, messages: Message[] = []): Branch {
  return { id, parentId, messages, scores: [], rolledBack: false };
}

export function appendMessage(branch: Branch, msg: Message): Branch {
  return { ...branch, messages: [...branch.messages, msg] };
}

export function recordScore(branch: Branch, score: number): Branch {
  return { ...branch, scores: [...branch.scores, score] };
}

export function markRolledBack(branch: Branch): Branch {
  return { ...branch, rolledBack: true };
}

export function latestScore(branch: Branch): number {
  return branch.scores.at(-1) ?? 0;
}

export function scoreTrend(branch: Branch, window = 5): number[] {
  return branch.scores.slice(-window);
}

// ── Rollback decision (pure) ──────────────────────────────────────────────────

export function shouldRollback(branch: Branch): boolean {
  const trend = scoreTrend(branch, 3);
  if (trend.length < 3) return false;
  // Require every step to be strictly lower than the previous (not just first vs last).
  // e.g. [0.3, 0.9, 0.4] would be a false positive with first-vs-last comparison.
  const declining = trend.every((s, i) => i === 0 || s < trend[i - 1]!);
  const stubbornlyLow = latestScore(branch) < 0.2 && branch.messages.length > 8;
  return declining || stubbornlyLow;
}

// ── State transitions (pure — return new state, never mutate) ─────────────────

export function makeInitialState(config: EvalConfig, runId: string): EvalState {
  return {
    runId,
    config,
    branches: [makeBranch(0, null)],
    currentBranchId: 0,
    totalTurns: 0,
    totalRollbacks: 0,
    status: "running",
    successTurn: null,
  };
}

function updateCurrentBranch(state: EvalState, updater: (b: Branch) => Branch): EvalState {
  return {
    ...state,
    branches: state.branches.map((b) =>
      b.id === state.currentBranchId ? updater(b) : b,
    ),
  };
}

export function addMessageToState(state: EvalState, msg: Message): EvalState {
  return {
    ...updateCurrentBranch(state, (b) => appendMessage(b, msg)),
    totalTurns: state.totalTurns + 1,
  };
}

export function addScoreToState(state: EvalState, score: number): EvalState {
  return updateCurrentBranch(state, (b) => recordScore(b, score));
}

export function rollbackState(state: EvalState): Result<EvalState> {
  if (state.totalRollbacks >= state.config.maxRollbacks) {
    return err({ kind: "state_error", message: "Max rollbacks reached" });
  }

  const current = state.branches.find((b) => b.id === state.currentBranchId);
  if (!current) {
    return err({ kind: "state_error", message: "Current branch not found" });
  }

  // Roll back to an even number of messages so role alternation (user/assistant)
  // is preserved. Dropping 4 messages = 2 full turns.
  const rollbackDepth = Math.max(0, Math.floor((current.messages.length - 4) / 2) * 2);
  const newBranchId = state.branches.length;

  const newBranch = makeBranch(
    newBranchId,
    current.id,
    current.messages.slice(0, rollbackDepth),
  );

  return ok({
    ...state,
    branches: [...state.branches.map((b) =>
      b.id === current.id ? markRolledBack(b) : b,
    ), newBranch],
    currentBranchId: newBranchId,
    totalRollbacks: state.totalRollbacks + 1,
  });
}

export function setStatus(state: EvalState, status: EvalStatus, successTurn?: number): EvalState {
  return {
    ...state,
    status,
    successTurn: successTurn ?? state.successTurn,
  };
}

export function getCurrentBranch(state: EvalState): Result<Branch> {
  const branch = state.branches.find((b) => b.id === state.currentBranchId);
  if (!branch) {
    return err({ kind: "state_error", message: `Branch ${state.currentBranchId} not found` });
  }
  return ok(branch);
}

export function isComplete(state: EvalState): boolean {
  return state.status !== "running" || state.totalTurns >= state.config.maxTurns;
}
