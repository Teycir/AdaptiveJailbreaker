"use client";

import { KeyGate, useOpenRouterKey } from "@/components/KeyGate";
import { EvalLauncher } from "@/components/EvalLauncher";
import Link from "next/link";

export default function Home() {
  const { key, saveKey, clearKey, loaded } = useOpenRouterKey();

  if (!loaded) return null; // Avoid hydration mismatch

  if (!key) return <KeyGate onKey={saveKey} />;

  return (
    <main className="relative">
      <nav className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur border-b border-zinc-900
                      flex items-center justify-between px-6 py-3">
        <span className="text-sm font-bold text-zinc-300">AJAR</span>
        <Link href="/results" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          Results →
        </Link>
      </nav>
      <EvalLauncher apiKey={key} onClearKey={clearKey} />
    </main>
  );
}
