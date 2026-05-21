"use client";

import { useEffect, useRef, useState } from "react";
import type { TraceEvent, EvalState, EvalStatus } from "@ajar/types";

const API_WS = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787")
  .replace(/^http/, "ws");

interface TraceEntry {
  id: number;
  event: TraceEvent;
}

interface Props {
  evalId: string;
}

// ── Snapshot reconstruction ────────────────────────────────────────────────────
// Rebuilds a flat TraceEntry list from EvalState so late-joining clients or
// page-refreshes mid-run display a complete trace (fix #1).

function reconstructEntries(
  state: EvalState,
  startId: number,
): { entries: TraceEntry[]; nextId: number } {
  const entries: TraceEntry[] = [];
  let id = startId;

  for (const branch of state.branches) {
    const { messages, scores } = branch;
    let scoreIdx = 0;

    for (const msg of messages) {
      if (msg.role === "user") {
        entries.push({
          id: id++,
          event: { type: "attacker_msg", content: msg.content, branchId: branch.id },
        });
      } else if (msg.role === "assistant") {
        const score = scores[scoreIdx] ?? 0;
        scoreIdx++;
        entries.push({
          id: id++,
          event: { type: "target_msg", content: msg.content, score, branchId: branch.id },
        });
      }
    }

    if (branch.rolledBack) {
      // Best-effort: find the child branch spawned after this rollback
      const child = state.branches.find((b) => b.parentId === branch.id);
      entries.push({
        id: id++,
        event: {
          type: "rollback",
          fromBranch: branch.id,
          toBranch: child?.id ?? branch.id,
          reason: "previous branch stalled",
        },
      });
    }
  }

  // Replay a terminal event so status badges and summary render correctly
  if (state.status !== "running") {
    entries.push({
      id: id++,
      event: {
        type: "complete",
        success: state.status === "success",
        turns: state.totalTurns,
        rollbacks: state.totalRollbacks,
      },
    });
  }

  return { entries, nextId: id };
}

export function TraceViewer({ evalId }: Props) {
  const [entries, setEntries] = useState<TraceEntry[]>([]);
  const [status, setStatus] = useState<EvalStatus | "connecting">("connecting");
  const [summary, setSummary] = useState<{ turns: number; rollbacks: number; success: boolean } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Fix #6: per-instance counter in a ref avoids Strict Mode double-mount
  // producing duplicate keys from the old module-level _counter.
  const counterRef = useRef(0);

  useEffect(() => {
    // Fix #6: mounted guard ensures the second Strict Mode mount's connection
    // is closed before it appends any events, keeping the list clean in dev.
    let mounted = true;
    const ws = new WebSocket(`${API_WS}/evals/${evalId}/ws`);

    ws.onopen = () => { if (mounted) setStatus("running"); };

    ws.onmessage = (e) => {
      if (!mounted) return;

      const event = JSON.parse(e.data as string) as TraceEvent;

      // Fix #1: reconstruct full trace from the DO snapshot so late-joining
      // clients (refresh, navigate-back) see the complete history.
      if (event.type === "snapshot") {
        const { entries: reconstructed, nextId } = reconstructEntries(
          event.state,
          counterRef.current,
        );
        counterRef.current = nextId;
        setEntries(reconstructed);

        const s = event.state.status;
        setStatus(s === "running" ? "running" : s);
        if (s !== "running") {
          setSummary({
            turns: event.state.totalTurns,
            rollbacks: event.state.totalRollbacks,
            success: s === "success",
          });
        }
        return;
      }

      setEntries((prev) => [...prev, { id: counterRef.current++, event }]);

      if (event.type === "status_change") setStatus(event.status);
      if (event.type === "complete") {
        setSummary({ turns: event.turns, rollbacks: event.rollbacks, success: event.success });
        setStatus(event.success ? "success" : "abandoned");
      }
    };

    ws.onerror = () => { if (mounted) setStatus("failed"); };
    ws.onclose = () => {
      if (mounted) setStatus((s) => (s === "connecting" || s === "running") ? "abandoned" : s);
    };

    return () => {
      mounted = false;
      ws.close();
    };
  }, [evalId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto px-4 py-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-zinc-100">Trace — {evalId.slice(0, 8)}…</h1>
          <StatusBadge status={status} />
        </div>
        {summary && (
          <div className="text-xs text-zinc-400 text-right leading-relaxed">
            <div>Turns: <span className="text-zinc-200">{summary.turns}</span></div>
            <div>Rollbacks: <span className="text-zinc-200">{summary.rollbacks}</span></div>
            <div>Result: <span className={summary.success ? "text-green-400" : "text-red-400"}>
              {summary.success ? "Success" : "Failed"}
            </span></div>
          </div>
        )}
      </div>

      {/* Trace feed */}
      <div className="flex-1 overflow-y-auto trace-scroll flex flex-col gap-2 pb-4">
        {entries.map(({ id, event }) => (
          <EventRow key={id} event={event} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Event renderers ────────────────────────────────────────────────────────────

function EventRow({ event }: { event: TraceEvent }) {
  switch (event.type) {
    case "turn_start":
      return (
        <div className="text-xs text-zinc-600 border-t border-zinc-800 pt-2 mt-1">
          Turn {event.turn} · Branch {event.branchId}
        </div>
      );

    case "attacker_msg":
      return (
        <Bubble role="attacker" branchId={event.branchId}>
          {event.content}
        </Bubble>
      );

    case "target_msg":
      return (
        <Bubble role="target" branchId={event.branchId} score={event.score}>
          {event.content}
        </Bubble>
      );

    case "tool_intercept":
      return (
        <div className="text-xs px-3 py-2 rounded-lg bg-yellow-950/40 border border-yellow-800/40 text-yellow-300">
          🔧 Tool: <span className="font-semibold">{event.tool}</span>
          {event.simulated ? " (simulated — not executed)" : " (allowed)"}
        </div>
      );

    case "rollback":
      return (
        <div className="text-xs px-3 py-2 rounded-lg bg-orange-950/40 border border-orange-800/40 text-orange-300">
          ↩ Rollback branch {event.fromBranch} → {event.toBranch} · {event.reason}
        </div>
      );

    case "score_update":
      return (
        <div className="text-xs text-zinc-600 flex gap-2 items-center">
          Score: <ScoreBar value={event.score} /> {(event.score * 100).toFixed(0)}%
        </div>
      );

    case "status_change":
      return (
        <div className="text-xs px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400">
          Status → <span className="text-zinc-200">{event.status}</span>
          {event.message ? ` · ${event.message}` : ""}
        </div>
      );

    case "complete":
      return (
        <div className={`text-sm px-4 py-3 rounded-lg font-semibold border
          ${event.success
            ? "bg-green-950/40 border-green-700/40 text-green-300"
            : "bg-red-950/40 border-red-700/40 text-red-300"
          }`}>
          {event.success ? "✓ Attack succeeded" : "✗ Attack failed"} in {event.turns} turns
          ({event.rollbacks} rollback{event.rollbacks !== 1 ? "s" : ""})
        </div>
      );

    default:
      return null;
  }
}

function Bubble({
  role, branchId, score, children,
}: {
  role: "attacker" | "target";
  branchId: number;
  score?: number;
  children: string;
}) {
  const isAttacker = role === "attacker";
  return (
    <div className={`flex flex-col gap-1 ${isAttacker ? "items-start" : "items-end"}`}>
      <div className="text-xs text-zinc-600">
        {isAttacker ? "attacker" : "target"} · branch {branchId}
        {score !== undefined && (
          <span className={` ml-2 ${scoreColor(score)}`}>
            score {(score * 100).toFixed(0)}%
          </span>
        )}
      </div>
      <div
        className={`max-w-[85%] text-sm px-4 py-2.5 rounded-2xl leading-relaxed whitespace-pre-wrap
          ${isAttacker
            ? "bg-blue-950/60 border border-blue-800/40 text-blue-100 rounded-tl-sm"
            : "bg-zinc-800/80 border border-zinc-700/40 text-zinc-200 rounded-tr-sm"
          }`}
      >
        {children}
      </div>
    </div>
  );
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="inline-flex w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${scoreBarColor(value)}`}
        style={{ width: `${value * 100}%` }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: EvalStatus | "connecting" }) {
  const map: Record<string, string> = {
    connecting: "text-zinc-500",
    running:    "text-blue-400",
    success:    "text-green-400",
    failed:     "text-red-400",
    abandoned:  "text-orange-400",
  };
  return <span className={`text-xs font-mono ${map[status] ?? "text-zinc-400"}`}>{status}</span>;
}

function scoreColor(v: number) {
  if (v >= 0.75) return "text-red-400";
  if (v >= 0.4)  return "text-yellow-400";
  return "text-zinc-500";
}

function scoreBarColor(v: number) {
  if (v >= 0.75) return "bg-red-400";
  if (v >= 0.4)  return "bg-yellow-400";
  return "bg-zinc-500";
}
