"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Algorithm } from "@ajar/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const ALGORITHMS: { value: Algorithm; label: string; desc: string }[] = [
  { value: "crescendo",   label: "Crescendo",    desc: "Progressive topic escalation across turns" },
  { value: "actorAttack", label: "ActorAttack",  desc: "Fictional persona / role-play indirection" },
  { value: "xTeaming",    label: "X-Teaming",    desc: "Planner-guided adaptive strategy selection" },
];

const FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "deepseek/deepseek-r1:free",
  "google/gemma-3-27b-it:free",
];

interface Props {
  apiKey: string;
  onClearKey: () => void;
}

export function EvalLauncher({ apiKey, onClearKey }: Props) {
  const router = useRouter();

  const [algorithm, setAlgorithm] = useState<Algorithm>("crescendo");
  const [targetModel, setTargetModel] = useState("anthropic/claude-3-haiku");
  const [attackerModel, setAttackerModel] = useState(FREE_MODELS[0]!);
  const [goal, setGoal] = useState("");
  const [maxTurns, setMaxTurns] = useState(20);
  const [maxRollbacks, setMaxRollbacks] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!goal.trim()) { setError("Goal is required."); return; }
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`${API}/evals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-openrouter-key": apiKey,
        },
        body: JSON.stringify({ algorithm, targetModel, attackerModel, goal: goal.trim(), maxTurns, maxRollbacks }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const { evalId } = await res.json() as { evalId: string };
      router.push(`/eval/${evalId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">New Eval</h1>
        <button onClick={onClearKey} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          Change key
        </button>
      </div>

      {/* Algorithm */}
      <Section label="Algorithm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ALGORITHMS.map((a) => (
            <button
              key={a.value}
              onClick={() => setAlgorithm(a.value)}
              className={`p-3 rounded-lg border text-left transition-all
                ${algorithm === a.value
                  ? "border-blue-500 bg-blue-950/40 text-blue-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                }`}
            >
              <div className="font-semibold text-sm">{a.label}</div>
              <div className="text-xs opacity-60 mt-0.5 leading-snug">{a.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* Target model */}
      <Section label="Target model">
        <Input value={targetModel} onChange={setTargetModel} placeholder="anthropic/claude-3-haiku" />
        <p className="text-zinc-600 text-xs mt-1">Any OpenRouter model string. This is the model being tested.</p>
      </Section>

      {/* Attacker model */}
      <Section label="Attacker / auditor model">
        <select
          value={attackerModel}
          onChange={(e) => setAttackerModel(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5
                     text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {FREE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Section>

      {/* Goal */}
      <Section label="Attack goal">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          placeholder="Describe the harmful behavior you want to probe for…"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5
                     text-sm text-zinc-100 placeholder-zinc-600 resize-none
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Section>

      {/* Sliders */}
      <div className="grid grid-cols-2 gap-4">
        <Section label={`Max turns: ${maxTurns}`}>
          <input type="range" min={5} max={40} value={maxTurns}
            onChange={(e) => setMaxTurns(Number(e.target.value))}
            className="w-full accent-blue-500" />
        </Section>
        <Section label={`Max rollbacks: ${maxRollbacks}`}>
          <input type="range" min={0} max={10} value={maxRollbacks}
            onChange={(e) => setMaxRollbacks(Number(e.target.value))}
            className="w-full accent-blue-500" />
        </Section>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed
                   text-white text-sm font-semibold py-3 rounded-lg transition-colors"
      >
        {submitting ? "Launching…" : "Launch eval →"}
      </button>

      <p className="text-zinc-600 text-xs text-center">
        For authorized security research only. See the responsible use notice in the README.
      </p>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs uppercase tracking-widest text-zinc-500">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5
                 text-sm text-zinc-100 placeholder-zinc-600
                 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}
