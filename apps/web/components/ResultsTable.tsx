"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EvalStatus } from "@ajar/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

interface EvalRow {
  id: string;
  algorithm: string;
  target_model: string;
  attacker_model: string;
  goal: string;
  status: EvalStatus;
  asr: number | null;
  turns: number | null;
  rollbacks: number | null;
  created_at: number;
}

interface Props { algorithm?: string; status?: EvalStatus }

export function ResultsTable({ algorithm, status }: Props) {
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams();
    if (algorithm) params.set("algorithm", algorithm);
    if (status)    params.set("status", status);
    fetch(`${API}/results?${params}`)
      .then(r => r.json() as Promise<EvalRow[]>)
      .then(data => { setRows(data); setLoading(false); })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, [algorithm, status]);

  if (loading) return (
    <div style={{ padding: "2rem 1.5rem", color: "rgba(255,255,255,0.25)", fontSize: "0.8rem" }}>Loading…</div>
  );
  if (error) return (
    <div style={{ padding: "2rem 1.5rem", color: "#f87171", fontSize: "0.8rem" }}>{error}</div>
  );
  if (rows.length === 0) return (
    <div style={{ padding: "3rem 1.5rem", color: "rgba(255,255,255,0.2)", fontSize: "0.82rem", textAlign: "center" }}>
      No results yet. <a href="/" style={{ color: "var(--neon-red)", textDecoration: "none" }}>Launch your first eval →</a>
    </div>
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="results-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Algorithm</th>
            <th style={{ width: 160 }}>Target</th>
            <th style={{ width: 220 }}>Goal</th>
            <th>Status</th>
            <th>ASR</th>
            <th>Turns</th>
            <th>RBs</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} onClick={() => router.push(`/eval/${row.id}`)}>
              <td style={{ fontFamily: "monospace", color: "rgba(255,26,26,0.6)", width: 90 }}>{row.id.slice(0, 8)}…</td>
              <td style={{ width: 110 }}>{row.algorithm}</td>
              <td style={{ maxWidth: 160 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.target_model}</span></td>
              <td style={{ maxWidth: 220 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.goal}</span></td>
              <td><StatusChip status={row.status} /></td>
              <td><AsrCell asr={row.asr} /></td>
              <td style={{ color: "rgba(255,255,255,0.5)" }}>{row.turns ?? "—"}</td>
              <td style={{ color: "rgba(255,255,255,0.5)" }}>{row.rollbacks ?? "—"}</td>
              <td style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.72rem" }}>{fmtTime(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusChip({ status }: { status: EvalStatus }) {
  const cls = { running: "chip chip-running", success: "chip chip-success", failed: "chip chip-failed", abandoned: "chip chip-abandoned" }[status] ?? "chip";
  return <span className={cls}>{status}</span>;
}

function AsrCell({ asr }: { asr: number | null }) {
  if (asr === null) return <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>;
  const pct = (asr * 100).toFixed(0) + "%";
  const color = asr >= 0.75 ? "#f87171" : asr > 0 ? "#eab308" : "rgba(255,255,255,0.3)";
  return <span style={{ fontFamily: "monospace", color, fontWeight: 600 }}>{pct}</span>;
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
