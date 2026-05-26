"use client";

import { useEffect, useRef, useState } from "react";
import type { TraceEvent, EvalState, EvalStatus } from "@ajar/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

interface TraceEntry { id: number; event: TraceEvent }
interface Props { evalId: string }

function replayHistory(
  stored: { ts: number; event: TraceEvent }[],
  startId: number,
): { entries: TraceEntry[]; nextId: number; status: EvalStatus | "connecting"; summary: SummaryData | null } {
  const entries: TraceEntry[] = [];
  let id = startId;
  let status: EvalStatus | "connecting" = "running";
  let summary: SummaryData | null = null;
  for (const { event } of stored) {
    entries.push({ id: id++, event });
    if (event.type === "status_change") status = event.status;
    if (event.type === "complete") {
      summary = { turns: event.turns, rollbacks: event.rollbacks, success: event.success };
      status = event.success ? "success" : "abandoned";
    }
  }
  return { entries, nextId: id, status, summary };
}

type SummaryData = { turns: number; rollbacks: number; success: boolean };

export function TraceViewer({ evalId }: Props) {
  const [entries,  setEntries]  = useState<TraceEntry[]>([]);
  const [status,   setStatus]   = useState<EvalStatus | "connecting">("connecting");
  const [summary,  setSummary]  = useState<SummaryData | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const feedRef    = useRef<HTMLDivElement>(null);
  const counterRef = useRef(0);
  const seenRef    = useRef(0);

  useEffect(() => {
    let mounted = true;
    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (!mounted) return;
      es = new EventSource(`${API_URL}/evals/${evalId}/stream`);
      es.onopen = () => { if (mounted) setStatus(s => s === "connecting" ? "running" : s); };
      es.onmessage = (e) => {
        if (!mounted) return;
        let payload: { ts: number; event: TraceEvent }[];
        try {
          const parsed = JSON.parse(e.data as string);
          payload = Array.isArray(parsed) ? parsed : [parsed];
        } catch { return; }
        const newItems = payload.slice(seenRef.current);
        if (newItems.length === 0) return;
        seenRef.current += newItems.length;
        const newEntries: TraceEntry[] = newItems.map(({ event }) => ({ id: counterRef.current++, event }));
        setEntries(prev => [...prev, ...newEntries]);
        for (const { event } of newItems) {
          if (event.type === "status_change") setStatus(event.status);
          if (event.type === "complete") {
            setSummary({ turns: event.turns, rollbacks: event.rollbacks, success: event.success });
            setStatus(event.success ? "success" : "abandoned");
            es?.close();
          }
        }
      };
      es.onerror = () => { if (!mounted) return; es?.close(); retryTimeout = setTimeout(connect, 3000); };
    }

    async function init() {
      try {
        const eventsRes = await fetch(`${API_URL}/evals/${evalId}/events`);
        const stored: { ts: number; event: TraceEvent }[] = eventsRes.ok ? await eventsRes.json() : [];
        if (!mounted) return;
        if (stored.length > 0) {
          const { entries: historical, nextId, status: s, summary: sm } = replayHistory(stored, 0);
          counterRef.current = nextId; seenRef.current = stored.length;
          setEntries(historical); setStatus(s);
          if (sm) setSummary(sm);
          if (s === "success" || s === "failed" || s === "abandoned") return;
        }
        connect();
      } catch { if (mounted) connect(); }
    }

    init();
    return () => { mounted = false; es?.close(); if (retryTimeout) clearTimeout(retryTimeout); };
  }, [evalId]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, autoScroll]);

  // Detect manual scroll up → pause auto-scroll
  const handleScroll = () => {
    const el = feedRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
  };

  const isLive = status === "running" || status === "connecting";

  return (
    <div className="page-shell" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Nav */}
      <nav className="site-nav" style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
          <a href="/" className="site-nav-logo">AJAR</a>
          <span style={{ color: "rgba(255,26,26,0.25)", fontSize: "0.7rem" }}>/</span>
          <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em" }}>
            trace <span style={{ color: "rgba(255,26,26,0.55)", fontFamily: "monospace" }}>{evalId.slice(0, 8)}…</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <StatusBadge status={status} />
          <a href="/results" style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textDecoration: "none", textTransform: "uppercase" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,26,26,0.6)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
            Results
          </a>
        </div>
      </nav>

      {/* Sub-header with summary */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.6rem 1.5rem",
        background: "rgba(10,10,10,0.6)", borderBottom: "1px solid rgba(255,26,26,0.08)",
        marginTop: "3.5rem", // clear fixed nav
      }}>
        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.05em" }}>
          {entries.length} event{entries.length !== 1 ? "s" : ""}
          {isLive && <span style={{ color: "rgba(255,26,26,0.5)", marginLeft: "0.5rem" }}>● live</span>}
        </div>
        {summary && (
          <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.68rem" }}>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>Turns <strong style={{ color: "#e0e0e0" }}>{summary.turns}</strong></span>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>Rollbacks <strong style={{ color: "#e0e0e0" }}>{summary.rollbacks}</strong></span>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>Result <strong style={{ color: summary.success ? "#4ade80" : "#f87171" }}>{summary.success ? "Success" : "Failed"}</strong></span>
          </div>
        )}
        {!autoScroll && isLive && (
          <button onClick={() => { setAutoScroll(true); bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }}
            style={{ fontSize: "0.65rem", color: "var(--neon-red)", background: "none", border: "1px solid rgba(255,26,26,0.3)", borderRadius: "0.3rem", padding: "0.2rem 0.55rem", cursor: "pointer", fontFamily: "inherit" }}>
            ↓ Resume
          </button>
        )}
      </div>

      {/* Trace feed */}
      <div ref={feedRef} onScroll={handleScroll}
        style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.45rem", padding: "1.2rem 1.5rem 2rem" }}>
        {entries.length === 0 && (
          <div style={{ color: "rgba(255,255,255,0.18)", fontSize: "0.8rem", textAlign: "center", paddingTop: "4rem" }}>
            {status === "connecting" ? "Connecting to eval stream…" : "Waiting for first event…"}
          </div>
        )}
        {entries.map(({ id, event }) => <EventRow key={id} event={event} />)}
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
        <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.18)", borderTop: "1px solid rgba(255,26,26,0.07)", paddingTop: "0.5rem", marginTop: "0.2rem", letterSpacing: "0.12em" }}>
          TURN {event.turn} · BRANCH {event.branchId}
        </div>
      );

    case "attacker_msg":
      return <Bubble role="attacker" branchId={event.branchId}>{event.content}</Bubble>;

    case "target_msg":
      return <Bubble role="target" branchId={event.branchId} score={event.score}>{event.content}</Bubble>;

    case "tool_intercept":
      return (
        <div style={{ fontSize: "0.72rem", padding: "0.5rem 0.75rem", borderRadius: "0.4rem", background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.18)", color: "rgba(234,179,8,0.8)" }}>
          🔧 Tool: <strong>{event.tool}</strong>{event.simulated ? " — simulated" : " — allowed"}
        </div>
      );

    case "rollback":
      return (
        <div style={{ fontSize: "0.72rem", padding: "0.5rem 0.75rem", borderRadius: "0.4rem", background: "rgba(251,146,60,0.06)", border: "1px solid rgba(251,146,60,0.18)", color: "rgba(251,146,60,0.85)" }}>
          ↩ Rollback branch {event.fromBranch} → {event.toBranch} · {event.reason}
        </div>
      );

    case "score_update":
      return (
        <div style={{ fontSize: "0.67rem", color: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          score <ScoreBar value={event.score} /> {(event.score * 100).toFixed(0)}%
          {event.trend.length > 1 && (
            <span style={{ opacity: 0.45 }}>[{event.trend.map(v => (v * 100).toFixed(0)).join(" → ")}]</span>
          )}
        </div>
      );

    case "status_change":
      return (
        <div style={{ fontSize: "0.7rem", padding: "0.38rem 0.75rem", borderRadius: "0.35rem", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
          status → <span style={{ color: "#e0e0e0" }}>{event.status}</span>
          {event.message ? <span style={{ opacity: 0.45 }}> · {event.message}</span> : ""}
        </div>
      );

    case "complete":
      return (
        <div style={{
          fontSize: "0.85rem", padding: "0.85rem 1.1rem", borderRadius: "0.5rem", fontWeight: 700,
          background: event.success ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
          border: `1px solid ${event.success ? "rgba(74,222,128,0.22)" : "rgba(248,113,113,0.22)"}`,
          color: event.success ? "#4ade80" : "#f87171",
        }}>
          {event.success ? "✓ Attack succeeded" : "✗ Attack failed"} in {event.turns} turns
          <span style={{ fontWeight: 400, opacity: 0.55 }}> · {event.rollbacks} rollback{event.rollbacks !== 1 ? "s" : ""}</span>
        </div>
      );

    default:
      return null;
  }
}

function Bubble({ role, branchId, score, children }: { role: "attacker" | "target"; branchId: number; score?: number; children: string }) {
  const isAttacker = role === "attacker";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", alignItems: isAttacker ? "flex-start" : "flex-end" }}>
      <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.08em" }}>
        {isAttacker ? "ATTACKER" : "TARGET"} · B{branchId}
        {score !== undefined && <span style={{ marginLeft: "0.45rem", color: scoreColor(score) }}>{(score * 100).toFixed(0)}%</span>}
      </div>
      <div className={isAttacker ? "bubble-attacker" : "bubble-target"}>{children}</div>
    </div>
  );
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div style={{ display: "inline-flex", width: 72, height: 3, borderRadius: 9999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: 9999, width: `${value * 100}%`, background: scoreBarColor(value), transition: "width 0.3s" }} />
    </div>
  );
}

function StatusBadge({ status }: { status: EvalStatus | "connecting" }) {
  const dot: Record<string, string> = { connecting: "#555", running: "#60a5fa", success: "#4ade80", failed: "#f87171", abandoned: "#fb923c" };
  const label: Record<string, string> = { connecting: "Connecting", running: "Running", success: "Success", failed: "Failed", abandoned: "Abandoned" };
  const d = dot[status] ?? "#555";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: d, flexShrink: 0,
        boxShadow: d !== "#555" ? `0 0 6px ${d}` : "none",
        animation: (status === "running" || status === "connecting") ? "pulse-glow 1.2s ease-in-out infinite" : "none" }} />
      <span style={{ fontSize: "0.63rem", letterSpacing: "0.12em", color: d, textTransform: "uppercase" }}>
        {label[status] ?? status}
      </span>
    </div>
  );
}

function scoreColor(v: number) {
  if (v >= 0.75) return "rgba(248,113,113,0.9)";
  if (v >= 0.4)  return "rgba(234,179,8,0.9)";
  return "rgba(255,255,255,0.22)";
}
function scoreBarColor(v: number) {
  if (v >= 0.75) return "#f87171";
  if (v >= 0.4)  return "#eab308";
  return "rgba(255,255,255,0.18)";
}
