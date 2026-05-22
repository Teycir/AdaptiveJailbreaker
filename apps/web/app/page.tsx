"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Algorithm } from "@ajar/types";

const STORAGE_KEY_MODEL    = "ajar_ollama_model";
const STORAGE_KEY_URL      = "ajar_api_url";
const DEFAULT_API          = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
const OLLAMA_BASE          = "http://localhost:11434";

// ── Types ─────────────────────────────────────────────────────────────────────

type OllamaStatus = "checking" | "online" | "offline";

interface OllamaModel {
  name: string;
  size: number;
  details: { parameter_size?: string; family?: string };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALGORITHMS: { value: Algorithm; label: string; desc: string }[] = [
  { value: "crescendo",   label: "Crescendo",   desc: "Progressive topic escalation" },
  { value: "actorAttack", label: "ActorAttack", desc: "Fictional persona indirection" },
  { value: "xTeaming",    label: "X-Teaming",   desc: "Planner-guided adaptive strategy" },
];

const FAQ = [
  { q: "What is AJAR?",              a: "AJAR (Adaptive Jailbreak Auditor & Red-teamer) is an automated AI red-teaming tool that uses multi-turn adversarial strategies to probe language model safety boundaries. Intended exclusively for authorized security research." },
  { q: "Does it need an API key?",   a: "No. AJAR runs entirely through your local Ollama instance — no external API keys required. Install Ollama, pull a model, and you're ready." },
  { q: "Which models can I target?", a: "Any model loaded in your local Ollama instance. Both the attacker and target can be any model you have pulled." },
  { q: "What are the algorithms?",   a: "Crescendo escalates topic sensitivity progressively. ActorAttack uses fictional persona indirection. X-Teaming uses a planner agent to select and adapt attack strategies dynamically." },
  { q: "Is this legal?",             a: "AJAR is intended for authorized security research only. You must have explicit permission to probe any model or system. Misuse may violate terms of service or applicable law." },
];

const STEPS = [
  { n: "01", title: "Configure",  body: "Open admin (⚙) to verify Ollama is live and pick your model." },
  { n: "02", title: "Set Goal",   body: "Define the attack goal — the harmful behavior or policy boundary to probe in natural language." },
  { n: "03", title: "Launch",     body: "The engine runs multi-turn adversarial dialogue, using rollbacks and strategy mutations to maximise success rate." },
  { n: "04", title: "Analyze",    body: "Review the full conversation trace, turn-by-turn scores, and rollback tree to understand how safety breaks down." },
];


// ── Ollama hook ───────────────────────────────────────────────────────────────

function useOllama() {
  const [status, setStatus]   = useState<OllamaStatus>("checking");
  const [models, setModels]   = useState<OllamaModel[]>([]);
  const [selected, setSelectedRaw] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_MODEL) ?? "" : ""
  );

  const setSelected = useCallback((name: string) => {
    setSelectedRaw(name);
    localStorage.setItem(STORAGE_KEY_MODEL, name);
  }, []);

  const check = useCallback(async () => {
    setStatus("checking");
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error();
      const data = await res.json() as { models?: OllamaModel[] };
      const list = (data.models ?? []).filter(m =>
        // exclude embedding-only models (no chat capability)
        !m.details?.family?.toLowerCase().includes("bert")
      );
      setModels(list);
      setStatus("online");
      // auto-select: prefer persisted, else first model
      const persisted = localStorage.getItem(STORAGE_KEY_MODEL) ?? "";
      const names = list.map(m => m.name);
      if (persisted && names.includes(persisted)) {
        setSelectedRaw(persisted);
      } else if (list.length > 0) {
        setSelected(list[0]!.name);
      }
    } catch {
      setStatus("offline");
      setModels([]);
    }
  }, [setSelected]);

  useEffect(() => { check(); }, [check]);

  return { status, models, selected, setSelected, refresh: check };
}


// ── Background / visual helpers ────────────────────────────────────────────────

function BackgroundBeams() {
  const [beams, setBeams] = useState<{ id: number; path: string; duration: number; delay: number }[]>([]);
  useEffect(() => {
    setBeams(Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      path: `M${Math.random()*100} -20 C ${Math.random()*100} 20, ${Math.random()*100} 80, ${Math.random()*100} 120`,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 10,
    })));
  }, []);
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
      <svg className="w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
        {beams.map(b => <path key={b.id} d={b.path} stroke="url(#redBeamGrad)" strokeWidth="0.2" strokeLinecap="round"
          style={{ opacity: 0, animation: `beamFade ${b.duration}s linear ${b.delay}s infinite` }} />)}
        <defs><linearGradient id="redBeamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ff1a1a" stopOpacity="0" />
          <stop offset="50%" stopColor="#ff1a1a" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ff1a1a" stopOpacity="0" />
        </linearGradient></defs>
      </svg>
    </div>
  );
}

function TextScramble({ children, className = "", duration = 1.5 }: { children: string; className?: string; duration?: number }) {
  const CHARS = "!@#$%^&*()_+{}|:<>?0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const [display, setDisplay] = useState("");
  const [triggered, setTriggered] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setTriggered(true); obs.disconnect(); } }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!triggered) return;
    const chars = CHARS.split("");
    let frame = 0;
    const id = setInterval(() => {
      const progress = frame / (duration * 30);
      let out = "";
      for (let i = 0; i < children.length; i++) {
        out += i < Math.floor(progress * children.length) ? children[i] : (Math.random() < 0.1 ? " " : chars[Math.floor(Math.random() * chars.length)]!);
      }
      setDisplay(out);
      frame++;
      if (frame > duration * 30 + 12) { setDisplay(children); clearInterval(id); }
    }, 40);
    return () => clearInterval(id);
  }, [triggered, children, duration]);
  return <span ref={ref} className={className}>{display || children}</span>;
}

function TypingText({ phrases }: { phrases: string[] }) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [del, setDel] = useState(false);
  useEffect(() => {
    const target = phrases[idx % phrases.length]!;
    if (!del && text === target) { const t = setTimeout(() => setDel(true), 2200); return () => clearTimeout(t); }
    if (del && text === "")      { const t = setTimeout(() => { setDel(false); setIdx(i => i + 1); }, 400); return () => clearTimeout(t); }
    const t = setTimeout(() => setText(del ? text.slice(0, -1) : target.slice(0, text.length + 1)), del ? 40 : 70);
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
        <span style={{ color: "var(--neon-red)", fontSize: "1.1rem", flexShrink: 0 }}>{open ? "−" : "+"}</span>
      </button>
      <div className={`faq-answer${open ? " open" : ""}`}>{a}</div>
    </div>
  );
}

function ThreeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let animId: number;
    (async () => {
      // @ts-ignore
      const THREE = await import("three");
      const W = window.innerWidth, H = window.innerHeight;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
      camera.position.z = 5;
      const N = 1800, positions = new Float32Array(N * 3), colors = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        positions[i*3] = (Math.random()-0.5)*20; positions[i*3+1] = (Math.random()-0.5)*20; positions[i*3+2] = (Math.random()-0.5)*20;
        const bright = 0.3 + Math.random()*0.7; colors[i*3] = bright; colors[i*3+1] = Math.random()*0.05; colors[i*3+2] = Math.random()*0.05;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.75 });
      const points = new THREE.Points(geo, mat);
      scene.add(points);
      const icoGeo = new THREE.IcosahedronGeometry(2.5, 1);
      const ico = new THREE.Mesh(icoGeo, new THREE.MeshBasicMaterial({ color: 0xff1a1a, wireframe: true, transparent: true, opacity: 0.04 }));
      scene.add(ico);
      const torus = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.006, 8, 120), new THREE.MeshBasicMaterial({ color: 0xff1a1a, transparent: true, opacity: 0.12 }));
      torus.rotation.x = Math.PI / 2.5;
      scene.add(torus);
      let mouse = { x: 0, y: 0 };
      const onMM = (e: MouseEvent) => { mouse.x = (e.clientX/window.innerWidth-0.5)*0.3; mouse.y = (e.clientY/window.innerHeight-0.5)*0.3; };
      window.addEventListener("mousemove", onMM);
      const onR = () => { const W2=window.innerWidth,H2=window.innerHeight; camera.aspect=W2/H2; camera.updateProjectionMatrix(); renderer.setSize(W2,H2); };
      window.addEventListener("resize", onR);
      let t = 0;
      const tick = () => { animId=requestAnimationFrame(tick); t+=0.004; points.rotation.y=t*0.05+mouse.x; points.rotation.x=mouse.y*0.5; ico.rotation.y=t*0.08; ico.rotation.x=t*0.04; torus.rotation.z=t*0.06; renderer.render(scene,camera); };
      tick();
      return () => { window.removeEventListener("mousemove", onMM); window.removeEventListener("resize", onR); };
    })();
    return () => cancelAnimationFrame(animId);
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}


// ── Ollama status pill ─────────────────────────────────────────────────────────

function OllamaStatusPill({ status, onClick }: { status: OllamaStatus; onClick: () => void }) {
  const cfg = {
    checking: { dot: "#888",           text: "rgba(255,255,255,0.4)", label: "Checking…" },
    online:   { dot: "#22c55e",        text: "rgba(100,255,130,0.85)", label: "Ollama online" },
    offline:  { dot: "var(--neon-red)", text: "rgba(255,80,80,0.9)",   label: "Ollama offline" },
  }[status];
  return (
    <button onClick={onClick} title="Click to refresh" style={{
      display: "inline-flex", alignItems: "center", gap: "0.4rem",
      padding: "0.25rem 0.65rem", borderRadius: "999px",
      border: `1px solid ${cfg.dot}44`,
      background: `${cfg.dot}12`,
      color: cfg.text, fontSize: "0.68rem", fontFamily: "inherit",
      letterSpacing: "0.06em", cursor: "pointer", transition: "all 0.2s",
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0,
        boxShadow: status === "online" ? `0 0 6px ${cfg.dot}` : "none",
        animation: status === "checking" ? "pulse-glow 1s ease-in-out infinite" : "none",
      }} />
      {cfg.label}
      <span style={{ opacity: 0.5, fontSize: "0.6rem" }}>↺</span>
    </button>
  );
}

// ── Admin panel ────────────────────────────────────────────────────────────────

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
  apiUrl: string;
  onSaveApiUrl: (u: string) => void;
  ollama: ReturnType<typeof useOllama>;
}

function AdminPanel({ open, onClose, apiUrl, onSaveApiUrl, ollama }: AdminPanelProps) {
  const [urlInput, setUrlInput] = useState(apiUrl);
  const [urlSaved, setUrlSaved] = useState(false);
  useEffect(() => setUrlInput(apiUrl), [apiUrl]);

  const handleSaveUrl = () => {
    onSaveApiUrl(urlInput.trim());
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 1800);
  };

  const fmt = (bytes: number) => bytes > 1e9 ? `${(bytes/1e9).toFixed(1)} GB` : `${(bytes/1e6).toFixed(0)} MB`;

  return (
    <>
      <div className={`admin-overlay${open ? " open" : ""}`} onClick={onClose} />
      <aside className={`admin-panel${open ? " open" : ""}`}>
        <div style={{ padding: "1.5rem" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <div>
              <div className="section-label" style={{ marginBottom: "0.2rem" }}>Admin Panel</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#fff" }}>Settings & Status</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "1.3rem", cursor: "pointer" }}>✕</button>
          </div>

          {/* Ollama section */}
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div className="section-label" style={{ marginBottom: 0 }}>Ollama</div>
              <OllamaStatusPill status={ollama.status} onClick={ollama.refresh} />
            </div>

            {ollama.status === "offline" && (
              <div className="warning-banner" style={{ marginBottom: "0.75rem", fontSize: "0.7rem" }}>
                <span>⚠</span>
                <span>Ollama not reachable at <code style={{ color: "inherit" }}>localhost:11434</code>. Run <code style={{ color: "inherit" }}>ollama serve</code> then click ↺.</span>
              </div>
            )}

            {ollama.status === "online" && ollama.models.length === 0 && (
              <div className="warning-banner" style={{ marginBottom: "0.75rem", fontSize: "0.7rem" }}>
                <span>⚠</span>
                <span>No chat models found. Run <code style={{ color: "inherit" }}>ollama pull llama3</code> to get started.</span>
              </div>
            )}

            {ollama.models.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Active model — persists across sessions
                </label>
                <select
                  value={ollama.selected}
                  onChange={e => ollama.setSelected(e.target.value)}
                  className="cyber-input"
                  style={{ cursor: "pointer" }}
                >
                  {ollama.models.map(m => (
                    <option key={m.name} value={m.name}>
                      {m.name}{m.details?.parameter_size ? ` (${m.details.parameter_size})` : ""} — {fmt(m.size)}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: "0.67rem", color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
                  Both attacker and target will use this model unless overridden in the eval form.
                </p>
              </div>
            )}
          </div>

          {/* Worker URL */}
          <div style={{ marginBottom: "2rem" }}>
            <div className="section-label">Worker API URL</div>
            <input type="text" className="cyber-input" value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="http://localhost:8787"
              style={{ marginBottom: "0.5rem" }}
            />
            <button className="cyber-button" onClick={handleSaveUrl} style={{ width: "100%", fontSize: "0.65rem" }}>
              {urlSaved ? "✓ Saved" : "Save URL"}
            </button>
          </div>

          {/* Session info */}
          <div style={{ borderTop: "1px solid rgba(255,26,26,0.1)", paddingTop: "1.5rem" }}>
            <div className="section-label">Session</div>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", lineHeight: 2 }}>
              <div>Ollama: <span style={{ color: ollama.status === "online" ? "rgba(100,255,130,0.7)" : "rgba(255,60,60,0.7)" }}>{ollama.status}</span></div>
              <div>Models loaded: <span style={{ color: "rgba(255,26,26,0.6)" }}>{ollama.models.length}</span></div>
              <div>Selected: <span style={{ color: "rgba(255,26,26,0.6)" }}>{ollama.selected || "—"}</span></div>
              <div>Worker URL: <span style={{ color: "rgba(255,26,26,0.6)" }}>{urlInput || "default"}</span></div>
              <div>Version: <span style={{ color: "rgba(255,26,26,0.6)" }}>0.1.0-alpha</span></div>
            </div>
          </div>

          <div className="warning-banner" style={{ marginTop: "2rem" }}>
            <span>⚠</span><span>Authorized security research only. Misuse may be illegal.</span>
          </div>
        </div>
      </aside>
    </>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const router   = useRouter();
  const ollama   = useOllama();

  const [apiUrl, setApiUrl]             = useState(DEFAULT_API);
  const [adminOpen, setAdminOpen]       = useState(false);
  const [algorithm, setAlgorithm]       = useState<Algorithm>("crescendo");
  const [targetModel, setTargetModel]   = useState("");   // "" = use ollama.selected
  const [attackerModel, setAttackerModel] = useState(""); // "" = use ollama.selected
  const [goal, setGoal]                 = useState("");
  const [maxTurns, setMaxTurns]         = useState(20);
  const [maxRollbacks, setMaxRollbacks] = useState(5);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_URL);
    if (saved) setApiUrl(saved);
  }, []);

  const saveApiUrl = (u: string) => {
    localStorage.setItem(STORAGE_KEY_URL, u);
    setApiUrl(u);
  };

  const resolvedTarget   = targetModel   || ollama.selected;
  const resolvedAttacker = attackerModel || ollama.selected;

  const handleSubmit = async () => {
    if (!resolvedTarget || !resolvedAttacker) {
      setError("No Ollama model selected — open admin (⚙) to pick one.");
      return;
    }
    if (!goal.trim()) { setError("Attack goal is required."); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/evals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-openrouter-key": "ollama" },
        body: JSON.stringify({
          algorithm,
          targetModel:   `local/${resolvedTarget}`,
          attackerModel: `local/${resolvedAttacker}`,
          goal: goal.trim(),
          maxTurns,
          maxRollbacks,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const { evalId } = await res.json() as { evalId: string };
      router.push(`/eval/${evalId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setSubmitting(false);
    }
  };

  return (
    <>
      <ThreeBackground />
      <AdminPanel
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        apiUrl={apiUrl}
        onSaveApiUrl={saveApiUrl}
        ollama={ollama}
      />

      <div className="relative z-10 min-h-screen">

        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/30 border-b border-neon-red/10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-neon-red/10 border border-neon-red/30 rounded flex items-center justify-center text-neon-red font-bold">A</div>
              <span className="text-xl font-bold text-white">Adaptive Jailbreaker</span>
            </div>
            <div className="flex items-center gap-4">
              {/* Ollama pill in navbar */}
              <OllamaStatusPill status={ollama.status} onClick={ollama.refresh} />
              <a href="#how" className="text-sm text-zinc-400 hover:text-neon-red transition hidden sm:block">How It Works</a>
              <a href="#faq" className="text-sm text-zinc-400 hover:text-neon-red transition hidden sm:block">FAQ</a>
              <button onClick={() => setAdminOpen(true)} className="cyber-button" style={{ fontSize: "0.7rem", padding: "0.4rem 0.9rem" }}>⚙ Admin</button>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="pt-32 pb-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="relative inline-block mb-6">
              <BackgroundBeams />
              <h1 className="text-6xl font-black text-white mb-2 relative z-10">
                <TextScramble duration={2}>Adaptive Jailbreaker</TextScramble>
              </h1>
            </div>
            <p className="text-sm text-neon-red/50 font-mono">
              Adaptive Jailbreaker — Automated AI Red-Teaming
            </p>
            <p className="text-zinc-400 text-lg mt-6 max-w-2xl mx-auto">
              Automated multi-turn adversarial probing for AI safety research.{" "}
              <TypingText phrases={["Crescendo escalation", "ActorAttack personas", "X-Teaming strategies"]} />
            </p>
            {ollama.status === "offline" && (
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <span>⚠</span><span>Ollama offline — run <code>ollama serve</code> to enable evals</span>
              </div>
            )}
          </div>
        </section>

        {/* Eval form */}
        <section className="py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="cyber-card">
              <div className="section-label mb-6">Launch Evaluation</div>
              <div className="grid gap-6">

                {/* Algorithm */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">Algorithm</label>
                  <select value={algorithm} onChange={e => setAlgorithm(e.target.value as Algorithm)} className="cyber-input">
                    {ALGORITHMS.map(a => <option key={a.value} value={a.value}>{a.label} — {a.desc}</option>)}
                  </select>
                </div>

                {/* Model picker row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">Target model</label>
                    {ollama.models.length > 0 ? (
                      <select
                        value={targetModel || ollama.selected}
                        onChange={e => setTargetModel(e.target.value)}
                        className="cyber-input"
                      >
                        {ollama.models.map(m => (
                          <option key={m.name} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="cyber-input" style={{ color: "rgba(255,80,80,0.7)", fontSize: "0.78rem" }}>
                        {ollama.status === "checking" ? "Checking Ollama…" : "No models — ollama pull <model>"}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">Attacker model</label>
                    {ollama.models.length > 0 ? (
                      <select
                        value={attackerModel || ollama.selected}
                        onChange={e => setAttackerModel(e.target.value)}
                        className="cyber-input"
                      >
                        {ollama.models.map(m => (
                          <option key={m.name} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="cyber-input" style={{ color: "rgba(255,80,80,0.7)", fontSize: "0.78rem" }}>
                        {ollama.status === "checking" ? "Checking Ollama…" : "No models — ollama pull <model>"}
                      </div>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.25)", marginTop: "-1rem" }}>
                  Default model ({ollama.selected || "none"}) set in Admin ⚙ and persisted in localStorage.
                </p>

                {/* Goal */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">Attack Goal</label>
                  <textarea value={goal} onChange={e => setGoal(e.target.value)}
                    placeholder="Describe the harmful behavior or policy boundary to probe…" rows={4} className="cyber-input" />
                </div>

                {/* Sliders */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">Max Turns: {maxTurns}</label>
                    <input type="range" min={5} max={40} value={maxTurns} onChange={e => setMaxTurns(+e.target.value)} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">Max Rollbacks: {maxRollbacks}</label>
                    <input type="range" min={0} max={10} value={maxRollbacks} onChange={e => setMaxRollbacks(+e.target.value)} className="w-full" />
                  </div>
                </div>

                {error && (
                  <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-4 py-2">{error}</div>
                )}

                <button onClick={handleSubmit} disabled={submitting || ollama.status !== "online" || ollama.models.length === 0}
                  className="cyber-button cyber-button-fill w-full">
                  {submitting ? "Launching…" : ollama.status === "checking" ? "Checking Ollama…" : ollama.status === "offline" ? "Ollama offline" : "Launch Eval"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-20 px-6 bg-black/20">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12"><TextScramble>How It Works</TextScramble></h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {STEPS.map(s => (
                <div key={s.n} className="step-card">
                  <div className="step-number">{s.n}</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "rgba(255,26,26,0.5)", marginBottom: "0.5rem" }}>{s.n}</div>
                  <h3 className="text-white font-bold text-lg mb-2">{s.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12"><TextScramble>FAQ</TextScramble></h2>
            <div className="space-y-4">{FAQ.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}</div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-neon-red/10 bg-black/30">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neon-red/50 font-mono px-2">
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <span className="text-neon-red/70">
                Built by <a href="https://teycirbensoltane.tn" target="_blank" rel="noopener noreferrer" className="hover:text-neon-red transition-colors underline">Teycir Ben Soltane</a>
              </span>
              <span>•</span>
              <a href="https://github.com/teycir/AdaptiveJailbreaker" target="_blank" rel="noopener noreferrer" className="hover:text-neon-red transition-colors">GitHub</a>
              <span>•</span>
              <a href="#how" className="hover:text-neon-red transition-colors">How It Works</a>
              <span>•</span>
              <a href="#faq" className="hover:text-neon-red transition-colors">FAQ</a>
            </div>
            <div>Adaptive Jailbreaker • Authorized Research Only</div>
          </div>
        </footer>

      </div>
    </>
  );
}
