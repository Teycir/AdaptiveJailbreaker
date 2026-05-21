"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "ajar_or_key";
const KEY_RE = /^sk-or-v1-[A-Za-z0-9_-]{32,}$/;

export function useOpenRouterKey() {
  const [key, setKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setKey(localStorage.getItem(STORAGE_KEY));
    setLoaded(true);
  }, []);

  const saveKey = (k: string) => {
    localStorage.setItem(STORAGE_KEY, k);
    setKey(k);
  };

  const clearKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    setKey(null);
  };

  return { key, saveKey, clearKey, loaded };
}

// ── KeyGate component ─────────────────────────────────────────────────────────

interface KeyGateProps {
  onKey: (key: string) => void;
}

export function KeyGate({ onKey }: KeyGateProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!KEY_RE.test(trimmed)) {
      setError("Key must start with sk-or-v1- and be at least 40 characters.");
      return;
    }
    setError("");
    onKey(trimmed);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-6">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-zinc-100 mb-1">AJAR</h1>
        <p className="text-zinc-400 text-sm mb-6">
          Adaptive Jailbreak Auditor — authorized security research only.
        </p>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
          <label className="text-xs uppercase tracking-widest text-zinc-500">
            OpenRouter API Key
          </label>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="sk-or-v1-…"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm
                       text-zinc-100 placeholder-zinc-600 focus:outline-none
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700
                       text-white text-sm font-semibold py-2.5 rounded-lg
                       transition-colors"
          >
            Continue
          </button>
          <p className="text-zinc-600 text-xs leading-relaxed">
            Your key is stored only in your browser (localStorage). It is sent
            to the evaluation worker per-request and never logged or stored
            server-side.
          </p>
        </div>
      </div>
    </div>
  );
}
