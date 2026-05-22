"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Algorithm } from "@ajar/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const ALGORITHMS: { value: Algorithm; label: string; desc: string }[] = [
  { value: "crescendo",   label: "Crescendo",    desc: "Progressive topic escalation across turns" },
  { value: "actorAttack", label: "ActorAttack",  desc: "Fictional persona / role-play indirection" },
  { value: "xTeaming",    label: "X-Teaming",    desc: "Planner-guided adaptive strategy selection" },
];

const OPENROUTER_FREE_MODELS = [
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

  const isOllamaMode = apiKey === "ollama";

  const [algorithm, setAlgorithm] = useState<Algorithm>("crescendo");
  const [targetModel, setTargetModel] = useState(
    isOllamaMode ? "ollama" : "anthropic/claude-3-haiku"
  );
  const [attackerModel, setAttackerModel] = useState(
    isOllamaMode ? "ollama" : OPENROUTER_FREE_MODELS[0]!
  );
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [maxTurns, setMaxTurns] = useState(20);
  const [maxRollbacks, setMaxRollbacks] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Fetch available Ollama models when in Ollama mode
  useEffect(() => {
    if (!isOllamaMode) return;
    fetch("http://localhost:11434/api/tags")
      .then((r) => r.json())
      .then((data: { models?: Array<{ name: string }> }) => {
        const names = data.models?.map((m) => m.name) ?? [];
        setOllamaModels(names);
        if (names.length > 0) {
          setAttackerModel(names[0]!);
          setTargetModel(names[0]!);
        }
      })
      .catch(() => {
        setError("Could not reach Ollama at localhost:11434. Is it running? Try: ollama serve");
      });
  }, [isOllamaMode]);

  const handleSubmit = async () => {
    if (!goal.trim()) { setError("Goal is required."); return; }
    setError("");
    setSubmitting(true);

    // In Ollama mode, prefix bare model names with "local/" so the engine
    // routes them to Ollama, unless the sentinel "ollama" is used directly.
    const resolveModel = (m: string) => {
      if (!isOllamaMode) return m;
      if (m === "ollama" || m.startsWith("local/")) return m;
      return `local/${m}`;
    };

    try {
      const res = await fetch(`${API}/evals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-openrouter-key": apiKey,
        },
        body: JSON.stringify({
          algorithm,
          targetModel: resolveModel(targetModel),
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">New Eval</h1>
          {isOllamaMode && (
            <span className="text-xs text-emerald-400 font-medium mt-0.5 block">
              ● Ollama local mode
            </span>
          )}
        </div>
        <button onClick={onClearKey} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          Change key
        </button>
      </div>

      {/* Algorithm */}
      <Section label="Algorithm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ALGORITHMS.map((a) => (
            <button key={a.value} onClick={() => setAlgorithm(a.value)}
              className={`p-3 rounded-lg border text-left transition-all ${
                algorithm === a.value
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
        {isOllamaMode
          ? <ModelSelect models={ollamaModels} value={targetModel} onChange={setTargetModel} />
          : <>
              <Input value={targetModel} onChange={setTargetModel} placeholder="anthropic/claude-3-haiku" />
              <p className="text-zinc-600 text-xs mt-1">Any OpenRouter model string. This is the model being tested.</p>
            </>
        }
      </Section>

      {/* Attacker model */}
      <Section label="Attacker / auditor model">
        {isOllamaMode
          ? <ModelSelect models={ollamaModels} value={attackerModel} onChange={setAttackerModel} />
          : <select value={attackerModel} onChange={(e) => setAttackerModel(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {OPENROUTER_FREE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
        }
      </Section>

      {/* Goal */}
      <Section label="Attack goal">
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3}
          placeholder="Describe the harmful behavior you want to probe for…"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Section>

      {/* Sliders */}
      <div className="grid grid-cols-2 gap-4">
        <Section label={`Max turns: ${maxTurns}`}>
          <input type="range" min={5} max={40} value={maxTurns}
            onChange={(e) => setMaxTurns(Number(e.target.value))} className="w-full accent-blue-500" />
        </Section>
        <Section label={`Max rollbacks: ${maxRollbacks}`}>
          <input type="range" min={0} max={10} value={maxRollbacks}
            onChange={(e) => setMaxRollbacks(Number(e.target.value))} className="w-full accent-blue-500" />
        </Section>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button onClick={handleSubmit} disabled={submitting}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-lg transition-colors">
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
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

function ModelSelect({ models, value, onChange }: { models: string[]; value: string; onChange: (v: string) => void }) {
  if (models.length === 0) {
    return (
      <p className="text-zinc-500 text-sm italic">
        No models found — run <code className="text-zinc-300">ollama pull &lt;model&gt;</code> first.
      </p>
    );
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
      {models.map((m) => <option key={m} value={m}>{m}</option>)}
    </select>
  );
}
