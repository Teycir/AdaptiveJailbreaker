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

interface Props {
  algorithm?: string;
  status?: EvalStatus;
}

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
      .then((r) => r.json() as Promise<EvalRow[]>)
      .then((data) => { setRows(data); setLoading(false); })
      .catch((err) => { setError(String(err)); setLoading(false); });
  }, [algorithm, status]);

  if (loading) return <p className="text-zinc-500 text-sm">Loading…</p>;
  if (error)   return <p className="text-red-400 text-sm">{error}</p>;
  if (rows.length === 0) return <p className="text-zinc-500 text-sm">No results yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
            <Th>ID</Th>
            <Th>Algorithm</Th>
            <Th>Target</Th>
            <Th>Goal</Th>
            <Th>Status</Th>
            <Th>ASR</Th>
            <Th>Turns</Th>
            <Th>Rollbacks</Th>
            <Th>Time</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => router.push(`/eval/${row.id}`)}
              className="border-b border-zinc-900 hover:bg-zinc-900/60 cursor-pointer transition-colors"
            >
              <Td>{row.id.slice(0, 8)}…</Td>
              <Td>{row.algorithm}</Td>
              <Td className="max-w-[160px] truncate">{row.target_model}</Td>
              <Td className="max-w-[200px] truncate">{row.goal}</Td>
              <Td><StatusCell status={row.status} /></Td>
              <Td><AsrCell asr={row.asr} /></Td>
              <Td>{row.turns ?? "—"}</Td>
              <Td>{row.rollbacks ?? "—"}</Td>
              <Td className="text-zinc-600">{fmtTime(row.created_at)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Cell helpers ──────────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-2 pr-4 font-medium">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2 pr-4 text-zinc-300 ${className}`}>{children}</td>;
}

function StatusCell({ status }: { status: EvalStatus }) {
  const map: Record<EvalStatus, string> = {
    running:   "text-blue-400",
    success:   "text-green-400",
    failed:    "text-red-400",
    abandoned: "text-orange-400",
  };
  return <span className={`font-mono ${map[status] ?? "text-zinc-400"}`}>{status}</span>;
}

function AsrCell({ asr }: { asr: number | null }) {
  if (asr === null) return <span className="text-zinc-600">—</span>;
  const pct = (asr * 100).toFixed(0) + "%";
  const color = asr >= 0.75 ? "text-red-400" : asr > 0 ? "text-yellow-400" : "text-zinc-500";
  return <span className={`font-mono ${color}`}>{pct}</span>;
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
