"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Algorithm } from "@ajar/types";
import { useKeyStatus, KeyStatusBanner } from "../components/KeyStatusBanner";

const STORAGE_KEY_MODEL = "ajar_ollama_model";
const STORAGE_KEY_URL   = "ajar_api_url";
const DEFAULT_API       = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
const OLLAMA_BASE       = "http://localhost:11434";

const GEMINI_DEFAULT_TARGET   = "gemini/gemini-2.5-flash-lite";
const GEMINI_DEFAULT_ATTACKER = "gemini/gemini-2.5-flash-lite";

type OllamaStatus = "checking" | "online" | "offline";
interface OllamaModel { name: string; size: number; details: { parameter_size?: string; family?: string } }

const ALGORITHMS: { value: Algorithm; label: string; desc: string }[] = [
  { value: "crescendo",   label: "Crescendo",   desc: "Progressive topic escalation" },
  { value: "actorAttack", label: "ActorAttack", desc: "Fictional persona indirection" },
  { value: "xTeaming",    label: "X-Teaming",   desc: "Planner-guided adaptive strategy" },
];

const FAQ = [
  { q: "What is AJAR?",              a: "AJAR (Adaptive Jailbreak Auditor & Red-teamer) is an automated AI red-teaming tool that uses multi-turn adversarial strategies to probe language model safety boundaries. Intended exclusively for authorized security research." },
  { q: "Does it need an API key?",   a: "No — API keys are configured server-side. Just set a goal and launch." },
  { q: "Which models can I target?", a: "Any Gemini model via the server-side key pool, or any model in your local Ollama instance." },
  { q: "What are the algorithms?",   a: "Crescendo escalates topic sensitivity progressively. ActorAttack uses fictional persona indirection. X-Teaming uses a planner agent to select and adapt attack strategies dynamically." },
  { q: "Is this legal?",             a: "AJAR is intended for authorized security research only. You must have explicit permission to probe any model or system. Misuse may violate terms of service or applicable law." },
];

const STEPS = [
  { n: "01", title: "Configure",  body: "Set your attack goal and algorithm. No API key entry needed — keys are pre-configured server-side." },
  { n: "02", title: "Set Goal",   body: "Define the attack goal — the harmful behavior or policy boundary to probe in natural language." },
  { n: "03", title: "Launch",     body: "The engine runs multi-turn adversarial dialogue, using rollbacks and strategy mutations to maximise success rate." },
  { n: "04", title: "Analyze",    body: "Review the full conversation trace, turn-by-turn scores, and rollback tree to understand how safety breaks down." },
];

const GEMINI_MODELS = [
  { value: "gemini/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (recommended)" },
  { value: "gemini/gemini-2.0-flash",      label: "Gemini 2.0 Flash" },
  { value: "gemini/gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
  { value: "gemini/gemini-1.5-pro",        label: "Gemini 1.5 Pro" },
  { value: "gemini/gemini-1.5-flash",      label: "Gemini 1.5 Flash" },
];

// ── Ollama hook ───────────────────────────────────────────────────────────────

function useOllama() {
  const [status, setStatus] = useState<OllamaStatus>("checking");
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selected, setSelectedRaw] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_MODEL) ?? "" : ""
  );
  const setSelected = useCallback((name: string) => {
    setSelectedRaw(name); localStorage.setItem(STORAGE_KEY_MODEL, name);
  }, []);

  const check = useCallback(async () => {
    setStatus("checking");
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error();
      const data = await res.json() as { models?: OllamaModel[] };
      const list = (data.models ?? []).filter(m => !m.details?.family?.toLowerCase().includes("bert"));
      setModels(list); setStatus("online");
      const persisted = localStorage.getItem(STORAGE_KEY_MODEL) ?? "";
      const names = list.map(m => m.name);
      if (persisted && names.includes(persisted)) setSelectedRaw(persisted);
      else if (list.length > 0) setSelected(list[0]!.name);
    } catch { setStatus("offline"); setModels([]); }
  }, [setSelected]);

  useEffect(() => { check(); }, [check]);
  return { status, models, selected, setSelected, refresh: check };
}

// ── Visual helpers ────────────────────────────────────────────────────────────

function TypingText({ phrases }: { phrases: string[] }) {
  const [idx, setIdx] = useState(0); const [text, setText] = useState(""); const [del, setDel] = useState(false);
  useEffect(() => {
    const target = phrases[idx % phrases.length]!;
    if (!del && text === target) { const t = setTimeout(() => setDel(true), 2200); return () => clearTimeout(t); }
    if (del && text === "")      { const t = setTimeout(() => { setDel(false); setIdx(i => i + 1); }, 400); return () => clearTimeout(t); }
    const t = setTimeout(() => setText(del ? text.slice(0, -1) : target.slice(0, text.length + 1)), del ? 40 : 68);
    return () => clearTimeout(t);
  }, [text, del, idx, phrases]);
  return <span><span className="glow-text">{text}</span><span className="cursor" /></span>;
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-item">
      <button className="faq-question" onClick={() => setOpen(o => !o)}>
        <span>{q}</span>
        <span style={{ color: "var(--neon-red)", fontSize: "1rem", flexShrink: 0, lineHeight: 1 }}>{open ? "−" : "+"}</span>
      </button>
      <div className={`faq-answer${open ? " open" : ""}`}>{a}</div>
    </div>
  );
}

function ThreeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let animId: number;
    (async () => {
      const THREE = await import("three");
      const W = window.innerWidth, H = window.innerHeight;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setSize(W, H);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000); camera.position.z = 5;
      const N = 1800, positions = new Float32Array(N * 3), colors = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        positions[i*3] = (Math.random()-.5)*20; positions[i*3+1] = (Math.random()-.5)*20; positions[i*3+2] = (Math.random()-.5)*20;
        const b = .3+Math.random()*.7; colors[i*3]=b; colors[i*3+1]=Math.random()*.04; colors[i*3+2]=Math.random()*.04;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: .042, vertexColors: true, transparent: true, opacity: .72 }));
      scene.add(points);
      const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5, 1), new THREE.MeshBasicMaterial({ color: 0xff1a1a, wireframe: true, transparent: true, opacity: .04 }));
      scene.add(ico);
      const torus = new THREE.Mesh(new THREE.TorusGeometry(3.5, .006, 8, 120), new THREE.MeshBasicMaterial({ color: 0xff1a1a, transparent: true, opacity: .1 }));
      torus.rotation.x = Math.PI / 2.5; scene.add(torus);
      let mouse = { x: 0, y: 0 };
      const onMM = (e: MouseEvent) => { mouse.x=(e.clientX/window.innerWidth-.5)*.3; mouse.y=(e.clientY/window.innerHeight-.5)*.3; };
      window.addEventListener("mousemove", onMM);
      const onR = () => { const W2=window.innerWidth,H2=window.innerHeight; camera.aspect=W2/H2; camera.updateProjectionMatrix(); renderer.setSize(W2,H2); };
      window.addEventListener("resize", onR);
      let t = 0;
      const tick = () => { animId=requestAnimationFrame(tick); t+=.004; points.rotation.y=t*.05+mouse.x; points.rotation.x=mouse.y*.5; ico.rotation.y=t*.08; ico.rotation.x=t*.04; torus.rotation.z=t*.06; renderer.render(scene,camera); };
      tick();
      return () => { window.removeEventListener("mousemove", onMM); window.removeEventListener("resize", onR); };
    })();
    return () => cancelAnimationFrame(animId);
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}

function OllamaStatusPill({ status, onClick }: { status: OllamaStatus; onClick: () => void }) {
  const cfg = {
    checking: { dot: "#888",     text: "rgba(255,255,255,0.38)", label: "Checking…" },
    online:   { dot: "#22c55e",  text: "rgba(100,255,130,0.85)", label: "Ollama online" },
    offline:  { dot: "#ff1a1a",  text: "rgba(255,80,80,0.85)",   label: "Ollama offline" },
  }[status];
  return (
    <button onClick={onClick} title="Click to refresh" style={{
      display: "inline-flex", alignItems: "center", gap: "0.4rem",
      padding: "0.25rem 0.65rem", borderRadius: "999px",
      border: `1px solid ${cfg.dot}44`, background: `${cfg.dot}10`,
      color: cfg.text, fontSize: "0.68rem", fontFamily: "inherit",
      letterSpacing: "0.06em", cursor: "pointer", transition: "all 0.2s",
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0,
        boxShadow: status === "online" ? `0 0 6px ${cfg.dot}` : "none",
        animation: status === "checking" ? "pulse-glow 1s ease-in-out infinite" : "none",
      }} />
      {cfg.label}<span style={{ opacity: 0.45, fontSize: "0.6rem" }}>↺</span>
    </button>
  );
}

// ── Admin panel ───────────────────────────────────────────────────────────────

interface AdminPanelProps {
  open: boolean; onClose: () => void; apiUrl: string; onSaveApiUrl: (u: string) => void;
  ollama: ReturnType<typeof useOllama>;
}

function AdminPanel({ open, onClose, apiUrl, onSaveApiUrl, ollama }: AdminPanelProps) {
  const [urlInput, setUrlInput] = useState(apiUrl);
  const [urlSaved, setUrlSaved] = useState(false);
  useEffect(() => setUrlInput(apiUrl), [apiUrl]);
  const handleSaveUrl = () => { onSaveApiUrl(urlInput.trim()); setUrlSaved(true); setTimeout(() => setUrlSaved(false), 1800); };
  const fmt = (bytes: number) => bytes > 1e9 ? `${(bytes/1e9).toFixed(1)} GB` : `${(bytes/1e6).toFixed(0)} MB`;

  return (
    <>
      <div className={`admin-overlay${open ? " open" : ""}`} onClick={onClose} />
      <aside className={`admin-panel${open ? " open" : ""}`}>
        <div style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <div>
              <div className="section-label" style={{ marginBottom: "0.2rem" }}>Admin Panel</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#e0e0e0" }}>Settings & Status</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: "1.2rem", cursor: "pointer", padding: "0.25rem" }}>✕</button>
          </div>

          {/* Ollama */}
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Ollama (optional)</div>
              <OllamaStatusPill status={ollama.status} onClick={ollama.refresh} />
            </div>
            {ollama.status === "offline" && (
              <div className="warning-banner" style={{ marginBottom: "0.75rem", fontSize: "0.7rem" }}>
                <span>⚠</span><span>Ollama offline — evals will use server-side Gemini keys.</span>
              </div>
            )}
            {ollama.status === "online" && ollama.models.length > 0 && (
              <select value={ollama.selected} onChange={e => ollama.setSelected(e.target.value)} className="cyber-input" style={{ cursor: "pointer" }}>
                {ollama.models.map(m => <option key={m.name} value={m.name}>{m.name}{m.details?.parameter_size ? ` (${m.details.parameter_size})` : ""} — {fmt(m.size)}</option>)}
              </select>
            )}
          </div>

          {/* Worker URL */}
          <div style={{ marginBottom: "2rem" }}>
            <div className="section-label">Worker API URL</div>
            <input type="text" className="cyber-input" value={urlInput} onChange={e => setUrlInput(e.target.value)}
              placeholder="http://localhost:8787" style={{ marginBottom: "0.5rem" }} />
            <button className="cyber-button" onClick={handleSaveUrl} style={{ width: "100%", fontSize: "0.65rem" }}>
              {urlSaved ? "✓ Saved" : "Save URL"}
            </button>
          </div>

          {/* Session info */}
          <div style={{ borderTop: "1px solid rgba(255,26,26,0.1)", paddingTop: "1.5rem", marginBottom: "2rem" }}>
            <div className="section-label">Session</div>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", lineHeight: 2 }}>
              <div>Ollama: <span style={{ color: ollama.status === "online" ? "rgba(100,255,130,0.7)" : "rgba(255,60,60,0.7)" }}>{ollama.status}</span></div>
              <div>Models: <span style={{ color: "rgba(255,26,26,0.6)" }}>{ollama.models.length}</span></div>
              <div>Worker: <span style={{ color: "rgba(255,26,26,0.6)" }}>{urlInput || "default"}</span></div>
              <div>Version: <span style={{ color: "rgba(255,26,26,0.6)" }}>0.1.0-alpha</span></div>
            </div>
          </div>

          <div className="warning-banner">
            <span>⚠</span><span>Authorized security research only. Misuse may be illegal.</span>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const ollama = useOllama();

  const [apiUrl, setApiUrl] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_URL) ?? DEFAULT_API : DEFAULT_API
  );
  const saveApiUrl = (u: string) => {
    localStorage.setItem(STORAGE_KEY_URL, u || DEFAULT_API);
    setApiUrl(u || DEFAULT_API);
  };

  const keyStatus = useKeyStatus(apiUrl);

  const [adminOpen,     setAdminOpen]     = useState(false);
  const [algorithm,     setAlgorithm]     = useState<Algorithm>("crescendo");
  const [targetModel,   setTargetModel]   = useState(GEMINI_DEFAULT_TARGET);
  const [attackerModel, setAttackerModel] = useState(GEMINI_DEFAULT_ATTACKER);
  const [goal,          setGoal]          = useState("");
  const [maxTurns,      setMaxTurns]      = useState(20);
  const [maxRollbacks,  setMaxRollbacks]  = useState(5);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState("");
  const [useOllamaMode, setUseOllamaMode] = useState(false);

  const resolveTargetModel   = () => useOllamaMode && ollama.selected ? `local/${ollama.selected}` : targetModel;
  const resolveAttackerModel = () => useOllamaMode && ollama.selected ? `local/${ollama.selected}` : attackerModel;

  const canLaunch = !submitting && keyStatus.status !== "down" && keyStatus.status !== "unconfigured";

  const handleLaunch = async () => {
    if (!goal.trim()) { setError("Attack goal is required."); return; }
    setError(""); setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/evals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm,
          targetModel:   resolveTargetModel(),
          attackerModel: resolveAttackerModel(),
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
    <div className="page-shell">
      <ThreeBackground />

      {/* ── Nav ── */}
      <nav className="site-nav">
        <a href="/" className="site-nav-logo">AJAR</a>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Key status pill — always visible in nav */}
          <KeyStatusPill status={keyStatus.status} data={keyStatus.data} onRefresh={keyStatus.refresh} />
          <a href="/results" style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textDecoration: "none", textTransform: "uppercase" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,26,26,0.7)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}>
            Results
          </a>
          <button onClick={() => setAdminOpen(true)} className="cyber-button" style={{ fontSize: "0.62rem", padding: "0.28rem 0.75rem", minHeight: "auto" }}>
            Settings
          </button>
        </div>
      </nav>

      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} apiUrl={apiUrl} onSaveApiUrl={saveApiUrl} ollama={ollama} />

      {/* ── Hero ── */}
      <section style={{ position: "relative", zIndex: 1, paddingTop: "9rem", paddingBottom: "3.5rem", textAlign: "center" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 2rem" }}>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.28em", color: "var(--neon-red)", textTransform: "uppercase", marginBottom: "1.4rem", opacity: 0.75 }}>
            Adaptive Jailbreak Auditor &amp; Red-teamer
          </div>
          <h1 style={{ fontSize: "clamp(2.4rem, 6vw, 4.2rem)", fontWeight: 900, lineHeight: 1.06, marginBottom: "1.1rem", letterSpacing: "-0.03em", color: "#fff" }}>
            Red-team any LLM.
          </h1>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.42)", maxWidth: 500, margin: "0 auto 2.5rem", lineHeight: 1.75 }}>
            <TypingText phrases={["Multi-turn adversarial attacks.", "Rollback-guided exploration.", "Server-side Gemini key pool.", "Authorized security research."]} />
          </p>
        </div>
      </section>

      {/* ── Launch form ── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto", padding: "0 1.5rem 6rem" }}>
        <div className="cyber-card" style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>

          {/* Key banner inside form only when degraded/down */}
          {(keyStatus.status === "degraded" || keyStatus.status === "down" || keyStatus.status === "unconfigured") && (
            <KeyStatusBanner status={keyStatus.status} data={keyStatus.data} lastChecked={keyStatus.lastChecked} onRefresh={keyStatus.refresh} />
          )}

          {/* Algorithm */}
          <div>
            <div className="section-label">Algorithm</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.5rem" }}>
              {ALGORITHMS.map(a => (
                <button key={a.value} onClick={() => setAlgorithm(a.value)} style={{
                  padding: "0.72rem 0.6rem", borderRadius: "0.5rem", textAlign: "left", cursor: "pointer", transition: "all 0.15s",
                  border: `1px solid ${algorithm === a.value ? "var(--neon-red)" : "rgba(255,255,255,0.08)"}`,
                  background: algorithm === a.value ? "rgba(255,26,26,0.09)" : "rgba(255,255,255,0.02)",
                  color: algorithm === a.value ? "#fff" : "rgba(255,255,255,0.45)",
                  fontFamily: "inherit",
                }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700 }}>{a.label}</div>
                  <div style={{ fontSize: "0.63rem", opacity: 0.55, marginTop: "0.2rem", lineHeight: 1.4 }}>{a.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Provider toggle (only when Ollama is available) */}
          {ollama.status === "online" && ollama.models.length > 0 && (
            <div style={{ display: "flex", gap: "0.6rem" }}>
              {[
                { label: "● Gemini (server)", active: !useOllamaMode, onClick: () => setUseOllamaMode(false), color: "#ff6666" },
                { label: "● Ollama (local)",  active: useOllamaMode,  onClick: () => setUseOllamaMode(true),  color: "#22c55e" },
              ].map(btn => (
                <button key={btn.label} onClick={btn.onClick} style={{
                  padding: "0.28rem 0.85rem", borderRadius: "999px", fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit",
                  border: `1px solid ${btn.active ? btn.color : "rgba(255,255,255,0.12)"}`,
                  background: btn.active ? `${btn.color}18` : "transparent",
                  color: btn.active ? btn.color : "rgba(255,255,255,0.38)",
                  transition: "all 0.15s",
                }}>{btn.label}</button>
              ))}
            </div>
          )}

          {/* Model selectors */}
          {!useOllamaMode ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <div className="section-label">Target model</div>
                <select value={targetModel} onChange={e => setTargetModel(e.target.value)} className="cyber-input" style={{ marginTop: "0.35rem" }}>
                  {GEMINI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <div className="section-label">Attacker model</div>
                <select value={attackerModel} onChange={e => setAttackerModel(e.target.value)} className="cyber-input" style={{ marginTop: "0.35rem" }}>
                  {GEMINI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <div className="section-label">Ollama model (target + attacker)</div>
              <select value={ollama.selected} onChange={e => ollama.setSelected(e.target.value)} className="cyber-input" style={{ marginTop: "0.35rem" }}>
                {ollama.models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
              </select>
            </div>
          )}

          {/* Goal */}
          <div>
            <div className="section-label">Attack goal</div>
            <textarea value={goal} onChange={e => { setGoal(e.target.value); setError(""); }} rows={3}
              placeholder="Describe the harmful behavior or policy boundary to probe…"
              style={{ marginTop: "0.35rem" }} />
          </div>

          {/* Sliders */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <div className="section-label">Max turns: {maxTurns}</div>
              <input type="range" min={5} max={40} value={maxTurns} onChange={e => setMaxTurns(Number(e.target.value))} style={{ width: "100%", marginTop: "0.35rem" }} />
            </div>
            <div>
              <div className="section-label">Max rollbacks: {maxRollbacks}</div>
              <input type="range" min={0} max={10} value={maxRollbacks} onChange={e => setMaxRollbacks(Number(e.target.value))} style={{ width: "100%", marginTop: "0.35rem" }} />
            </div>
          </div>

          {error && <p style={{ color: "#f87171", fontSize: "0.8rem", margin: 0 }}>{error}</p>}

          <button onClick={handleLaunch} disabled={!canLaunch} className="cyber-button cyber-button-fill"
            style={{ width: "100%", padding: "0.9rem", fontSize: "0.82rem", fontWeight: 800 }}>
            {submitting ? "Launching eval…" : "Launch eval →"}
          </button>

          <p style={{ fontSize: "0.66rem", color: "rgba(255,255,255,0.18)", textAlign: "center", margin: 0 }}>
            Authorized security research only · Keys are server-side · Nothing stored in your browser
          </p>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "0 1.5rem 5rem" }}>
        <div className="section-label" style={{ textAlign: "center", marginBottom: "2rem" }}>How it works</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "1.25rem" }}>
          {STEPS.map(s => (
            <div key={s.n} className="cyber-card" style={{ padding: "1.2rem" }}>
              <div style={{ fontSize: "1.7rem", fontWeight: 900, color: "var(--neon-red)", opacity: 0.22, lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", marginTop: "0.45rem", color: "#e0e0e0" }}>{s.title}</div>
              <div style={{ fontSize: "0.73rem", color: "rgba(255,255,255,0.38)", marginTop: "0.35rem", lineHeight: 1.65 }}>{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto", padding: "0 1.5rem 8rem" }}>
        <div className="section-label" style={{ textAlign: "center", marginBottom: "1.5rem" }}>FAQ</div>
        <div className="faq-list">
          {FAQ.map(item => <FaqItem key={item.q} q={item.q} a={item.a} />)}
        </div>
      </section>
    </div>
  );
}

// ── Minimal key status pill for nav ──────────────────────────────────────────

import type { KeyStatus, StatusData } from "../components/KeyStatusBanner";

function KeyStatusPill({ status, data, onRefresh }: { status: KeyStatus; data: StatusData | null; onRefresh: () => void }) {
  if (status === "loading") return null;
  const dot = { ok: "#22c55e", degraded: "#eab308", down: "#ff1a1a", unconfigured: "#ff1a1a" }[status] ?? "#888";
  const label = status === "ok"
    ? `${data?.usableKeys ?? "?"}/${data?.poolSize ?? "?"} keys`
    : status === "degraded" ? "degraded" : status === "unconfigured" ? "no keys" : "keys down";
  return (
    <button onClick={onRefresh} title="Re-check API keys" style={{
      display: "inline-flex", alignItems: "center", gap: "0.38rem",
      padding: "0.22rem 0.6rem", borderRadius: "999px",
      border: `1px solid ${dot}3a`, background: `${dot}0e`,
      color: dot, fontSize: "0.65rem", fontFamily: "inherit",
      letterSpacing: "0.05em", cursor: "pointer",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0,
        boxShadow: status === "ok" ? `0 0 5px ${dot}` : "none" }} />
      {label}
    </button>
  );
}
