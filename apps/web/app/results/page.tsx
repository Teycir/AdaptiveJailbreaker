"use client";

import { useState } from "react";
import Link from "next/link";
import { ResultsTable } from "@/components/ResultsTable";
import type { EvalStatus, Algorithm } from "@ajar/types";

export default function ResultsPage() {
  const [algorithm, setAlgorithm] = useState<Algorithm | "">("");
  const [status, setStatus] = useState<EvalStatus | "">("");

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Results</h1>
          <p className="text-zinc-500 text-xs mt-0.5">Click a row to open its trace</p>
        </div>
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          ← New eval
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value as Algorithm | "")}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All algorithms</option>
          <option value="crescendo">Crescendo</option>
          <option value="actorAttack">ActorAttack</option>
          <option value="xTeaming">X-Teaming</option>
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as EvalStatus | "")}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="abandoned">Abandoned</option>
          <option value="running">Running</option>
        </select>
      </div>

      {/* Table */}
      <ResultsTable
        algorithm={algorithm || undefined}
        status={(status as EvalStatus) || undefined}
      />
    </main>
  );
}
