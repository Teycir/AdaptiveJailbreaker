"use client";

import { useState } from "react";
import { ResultsTable } from "@/components/ResultsTable";
import type { EvalStatus, Algorithm } from "@ajar/types";

export default function ResultsPage() {
  const [algorithm, setAlgorithm] = useState<Algorithm | "">("");
  const [status, setStatus] = useState<EvalStatus | "">("");

  return (
    <div className="page-shell" style={{ minHeight: "100vh" }}>
      {/* Nav */}
      <nav className="site-nav">
        <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
          <a href="/" className="site-nav-logo">AJAR</a>
          <span style={{ color: "rgba(255,26,26,0.25)", fontSize: "0.7rem" }}>/</span>
          <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Results</span>
        </div>
        <a href="/" className="cyber-button" style={{ fontSize: "0.62rem", padding: "0.28rem 0.75rem", minHeight: "auto" }}>
          + New Eval
        </a>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "5.5rem 1.5rem 4rem" }}>
        {/* Page header */}
        <div style={{ marginBottom: "2rem" }}>
          <div className="section-label">Eval history</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#e0e0e0", marginTop: "0.25rem" }}>Results</h1>
          <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.28)", marginTop: "0.3rem" }}>Click a row to open its trace</p>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          <select value={algorithm} onChange={e => setAlgorithm(e.target.value as Algorithm | "")}
            style={{ width: "auto", flex: "0 0 auto" }}>
            <option value="">All algorithms</option>
            <option value="crescendo">Crescendo</option>
            <option value="actorAttack">ActorAttack</option>
            <option value="xTeaming">X-Teaming</option>
          </select>
          <select value={status} onChange={e => setStatus(e.target.value as EvalStatus | "")}
            style={{ width: "auto", flex: "0 0 auto" }}>
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="abandoned">Abandoned</option>
            <option value="running">Running</option>
          </select>
        </div>

        {/* Table */}
        <div className="cyber-card" style={{ padding: 0, overflow: "hidden" }}>
          <ResultsTable algorithm={algorithm || undefined} status={(status as EvalStatus) || undefined} />
        </div>
      </div>
    </div>
  );
}
