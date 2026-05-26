"use client";

// EvalLauncher — keyless variant.
// The worker resolves API keys from env (GEMINI_API_KEYS).
// No key is sent from the browser.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Algorithm } from "@ajar/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const ALGORITHMS: { value: Algorithm; label: string; desc: string }[] = [
  { value: "crescendo",   label: "Crescendo",   desc: "Progressive topic escalation across turns" },
  { value: "actorAttack", label: "ActorAttack", desc: "Fictional persona / role-play indirection" },
  { value: "xTeaming",    label: "X-Teaming",   desc: "Planner-guided adaptive strategy selection" },
];

const GEMINI_MODELS = [
  { value: "gemini/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (recommended)" },
  { value: "gemini/gemini-2.0-flash",      label: "Gemini 2.0 Flash (fast)" },
  { value: "gemini/gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
  { value: "gemini/gemini-1.5-pro",        label: "Gemini 1.5 Pro" },
  { value: "gemini/gemini-1.5-flash",      label: "Gemini 1.5 Flash" },
  { value: "gemini/gemini-1.5-flash-8b",   label: "Gemini 1.5 Flash-8B" },
];

const GEMINI_DEFAULT = "gemini/gemini-2.5-flash-lite";

// ── Component ─────────────────────────────────────────────────────────────────

export function EvalLauncher() {
  const router = useRouter();

  const [algorithm,     setAlgorithm]     = useState<Algorithm>("crescendo");
  const [targetModel,   setTargetModel]   = useState(GEMINI_DEFAULT);
  const [attackerModel, setAttackerModel] = useState(GEMINI_DEFAULT);
  const [ollamaModels,  setOllamaModels]  = useState<string[]>([]);
  const [ollamaOnline,  setOllamaOnline]  = useState(false);
  const [useOllama,     setUseOllama]     = useState(false);
  const [ollamaModel,   setOllamaModel]   = useState("");
  const [goal,          setGoal]          = useState("");
  const [maxTurns,      setMaxTurns]      = useState(20);
  const [maxRollbacks,  setMaxRollbacks]  = useState(5);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState("");

  // Probe Ollama availability
  useEffect(() => {
    fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then((data: { models?: Array<{ name: string }> }) => {
        const names = data.models?.map(m => m.name) ?? [];
        setOllamaModels(names);
        setOllamaOnline(names.length > 0);
        if (names.length > 0) setOllamaModel(names[0]!);
      })
      .catch(() => { /* offline */ });
  }, []);

  const handleSubmit = async () => {
    if (!goal.trim()) { setError("Goal is required."); return; }
    setError(""); setSubmitting(true);

    const resolveModel = (m: string) =>
      useOllama && ollamaModel ? `local/${ollamaModel}` : m;

    try {
      // No x-api-key header — worker uses server-side GEMINI_API_KEYS env secret
      const res = await fetch(`${API}/evals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm,
          targetModel:   resolveModel(targetModel),
          attackerModel: resolveModel(attackerModel),
          goal: goal.trim(),
          maxTurns,
          maxRollbacks,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const { evalId } = await res.json() as { evalId: string };
      router.push(`/eval/${evalId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">New Eval</h1>
          <div className="mt-0.5">
            {useOllama
              ? <span className="text-xs text-emerald-400 font-medium">● Ollama local mode</span>
              : <span className="text-xs text-blue-400 font-medium">● Gemini (server-side keys)</span>}
          </div>
        </div>
      </div>

      {/* Algorithm */}
      <Section label="Algorithm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ALGORITHMS.map(a => (
            <button key={a.value} onClick={() => setAlgorithm(a.value)}
              className={`p-3 rounded-lg border text-left transition-all ${
                algorithm === a.value
                  ? "border-blue-500 bg-blue-950/40 text-blue-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
              }`}>
              <div className="font-semibold text-sm">{a.label}</div>
              <div className="text-xs opacity-60 mt-0.5 leading-snug">{a.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* Ollama toggle (shown only when available) */}
      {ollamaOnline && (
        <Section label="Provider">
          <div className="flex gap-3">
            <button onClick={() => setUseOllama(false)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                !useOllama ? "border-blue-500 bg-blue-950/40 text-blue-300" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
              }`}>Gemini (server)</button>
            <button onClick={() => setUseOllama(true)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                useOllama ? "border-emerald-500 bg-emerald-950/40 text-emerald-300" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
              }`}>Ollama (local)</button>
          </div>
        </Section>
      )}

      {/* Model selectors */}
      {!useOllama ? (
        <>
          <Section label="Target model">
            <GeminiSelect value={targetModel} onChange={setTargetModel} />
          </Section>
          <Section label="Attacker / auditor model">
            <GeminiSelect value={attackerModel} onChange={setAttackerModel} />
            <p className="text-zinc-600 text-xs mt-1">Server-side Gemini key pool is used automatically.</p>
          </Section>
        </>
      ) : (
        <Section label="Ollama model (target + attacker)">
          <ModelSelect models={ollamaModels} value={ollamaModel} onChange={setOllamaModel} />
        </Section>
      )}

      {/* Goal */}
      <Section label="Attack goal">
        <textarea value={goal} onChange={e => setGoal(e.target.value)} rows={3}
          placeholder="Describe the harmful behavior you want to probe for…"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Section>

      {/* Sliders */}
      <div className="grid grid-cols-2 gap-4">
        <Section label={`Max turns: ${maxTurns}`}>
          <input type="range" min={5} max={40} value={maxTurns}
            onChange={e => setMaxTurns(Number(e.target.value))} className="w-full accent-blue-500" />
        </Section>
        <Section label={`Max rollbacks: ${maxRollbacks}`}>
          <input type="range" min={0} max={10} value={maxRollbacks}
            onChange={e => setMaxRollbacks(Number(e.target.value))} className="w-full accent-blue-500" />
        </Section>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button onClick={handleSubmit} disabled={submitting}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-lg transition-colors">
        {submitting ? "Launching…" : "Launch eval →"}
      </button>

      <p className="text-zinc-600 text-xs text-center">
        For authorized security research only. API keys are server-side — nothing is stored in your browser.
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

function GeminiSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
      {GEMINI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
    </select>
  );
}

function ModelSelect({ models, value, onChange }: { models: string[]; value: string; onChange: (v: string) => void }) {
  if (models.length === 0) {
    return <p className="text-zinc-500 text-sm italic">No models found — run <code className="text-zinc-300">ollama pull &lt;model&gt;</code> first.</p>;
  }
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
      {models.map(m => <option key={m} value={m}>{m}</option>)}
    </select>
  );
}
