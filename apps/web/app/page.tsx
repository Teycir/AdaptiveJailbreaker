"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Algorithm } from "@ajar/types";

const STORAGE_KEY_API = "ajar_or_key";
const STORAGE_KEY_URL = "ajar_api_url";
const KEY_RE = /^sk-or-v1-[A-Za-z0-9_-]{32,}$/;
const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const ALGORITHMS: { value: Algorithm; label: string; desc: string }[] = [
  { value: "crescendo",   label: "Crescendo",   desc: "Progressive topic escalation" },
  { value: "actorAttack", label: "ActorAttack", desc: "Fictional persona indirection" },
  { value: "xTeaming",    label: "X-Teaming",   desc: "Planner-guided adaptive strategy" },
];

const FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "deepseek/deepseek-r1:free",
  "google/gemma-3-27b-it:free",
];

const FAQ = [
  { q: "What is AJAR?", a: "AJAR (Adaptive Jailbreak Auditor & Red-teamer) is an automated AI red-teaming tool that uses multi-turn adversarial strategies to probe language model safety boundaries. It is intended exclusively for authorized security research." },
  { q: "Where is my API key stored?", a: "Your OpenRouter API key is stored only in your browser's localStorage. It is transmitted per-request to the evaluation worker and is never logged, persisted server-side, or shared with third parties." },
  { q: "Which models can I target?", a: "Any model available on OpenRouter can be targeted — paste the full OpenRouter model string (e.g. anthropic/claude-3-haiku). The attacker/auditor model is chosen from a curated list of free models to minimize cost." },
  { q: "What are the available algorithms?", a: "Crescendo escalates topic sensitivity progressively across turns. ActorAttack uses fictional persona indirection. X-Teaming uses a planner agent to select and adapt attack strategies dynamically." },
  { q: "Is this legal?", a: "AJAR is intended for authorized security research only. You must have explicit permission to probe any model or system. Misuse may violate terms of service or applicable law. The authors bear no liability for misuse." },
];

const STEPS = [
  { n: "01", title: "Configure", body: "Open the admin panel (⚙ top right) to store your OpenRouter API key and worker URL. Keys live only in localStorage." },
  { n: "02", title: "Set Goal", body: "Define the attack goal — the harmful behavior or policy boundary you want to probe for in natural language." },
  { n: "03", title: "Launch", body: "The engine runs multi-turn adversarial dialogue, using rollbacks and strategy mutations to maximize success rate." },
  { n: "04", title: "Analyze", body: "Review the full conversation trace, turn-by-turn scores, and rollback tree to understand how and where safety breaks down." },
];

function BackgroundBeams() {
  const [beams, setBeams] = useState<{ id: number; path: string; duration: number; delay: number }[]>([]);
  useEffect(() => {
    setBeams(Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      path: `M${Math.random() * 100} -20 C ${Math.random() * 100} 20, ${Math.random() * 100} 80, ${Math.random() * 100} 120`,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 10,
    })));
  }, []);
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
      <svg className="w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
        {beams.map(b => <path key={b.id} d={b.path} stroke="url(#redBeamGrad)" strokeWidth="0.2" strokeLinecap="round" style={{ opacity: 0, animation: `beamFade ${b.duration}s linear ${b.delay}s infinite` }} />)}
        <defs><linearGradient id="redBeamGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#ff1a1a" stopOpacity="0" /><stop offset="50%" stopColor="#ff1a1a" stopOpacity="0.5" /><stop offset="100%" stopColor="#ff1a1a" stopOpacity="0" /></linearGradient></defs>
      </svg>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-900/5 to-transparent blur-3xl opacity-20 pointer-events-none" />
    </div>
  );
}

function FloatingIcons() {
  const icons = ["⚔", "🛡", "🔬", "⚡", "🔴", "💀", "🧬", "🔒"];
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {icons.map((icon, i) => <span key={i} className="absolute text-2xl floating-icon" style={{ left: `${(i % 4) * 25 + 5}%`, top: `${Math.floor(i / 4) * 48 + 10}%`, animationDelay: `${i * 2.1}s`, animationDuration: `${20 + (i % 3) * 6}s` }}>{icon}</span>)}
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
        out += i < Math.floor(progress * children.length) ? children[i] : (Math.random() < 0.1 ? " " : chars[Math.floor(Math.random() * chars.length)]);
      }
      setDisplay(out);
      frame++;
      if (frame > duration * 30 + 12) { setDisplay(children); clearInterval(id); }
    }, 40);
    return () => clearInterval(id);
  }, [triggered, children, duration]);
  return <span ref={ref} className={className}>{display || children}</span>;
}

function AnimatedTagline({ text }: { text: string }) {
  return (
    <p className="text-sm text-neon-red/50 font-mono cursor-default tagline-shimmer">
      {text.split("").map((char, i) => <span key={i} className="inline-block char-reveal" style={{ animationDelay: `${(text.length - 1 - i) * 0.04}s` }}>{char === " " ? "\u00A0" : char}</span>)}
    </p>
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
        positions[i*3] = (Math.random() - 0.5) * 20; positions[i*3+1] = (Math.random() - 0.5) * 20; positions[i*3+2] = (Math.random() - 0.5) * 20;
        const bright = 0.3 + Math.random() * 0.7; colors[i*3] = bright; colors[i*3+1] = Math.random() * 0.05; colors[i*3+2] = Math.random() * 0.05;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.75 });
      const points = new THREE.Points(geo, mat);
      scene.add(points);
      const icoGeo = new THREE.IcosahedronGeometry(2.5, 1);
      const icoMat = new THREE.MeshBasicMaterial({ color: 0xff1a1a, wireframe: true, transparent: true, opacity: 0.04 });
      const ico = new THREE.Mesh(icoGeo, icoMat);
      scene.add(ico);
      const torusGeo = new THREE.TorusGeometry(3.5, 0.006, 8, 120);
      const torusMat = new THREE.MeshBasicMaterial({ color: 0xff1a1a, transparent: true, opacity: 0.12 });
      const torus = new THREE.Mesh(torusGeo, torusMat);
      torus.rotation.x = Math.PI / 2.5;
      scene.add(torus);
      let mouse = { x: 0, y: 0 };
      const onMM = (e: MouseEvent) => { mouse.x = (e.clientX / window.innerWidth - 0.5) * 0.3; mouse.y = (e.clientY / window.innerHeight - 0.5) * 0.3; };
      window.addEventListener("mousemove", onMM);
      const onR = () => { const W2 = window.innerWidth, H2 = window.innerHeight; camera.aspect = W2 / H2; camera.updateProjectionMatrix(); renderer.setSize(W2, H2); };
      window.addEventListener("resize", onR);
      let t = 0;
      const tick = () => { animId = requestAnimationFrame(tick); t += 0.004; points.rotation.y = t * 0.05 + mouse.x; points.rotation.x = mouse.y * 0.5; ico.rotation.y = t * 0.08; ico.rotation.x = t * 0.04; torus.rotation.z = t * 0.06; renderer.render(scene, camera); };
      tick();
      return () => { window.removeEventListener("mousemove", onMM); window.removeEventListener("resize", onR); };
    })();
    return () => { cancelAnimationFrame(animId); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}

function TypingText({ phrases }: { phrases: string[] }) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [del, setDel] = useState(false);
  useEffect(() => {
    const target = phrases[idx % phrases.length]!;
    if (!del && text === target) { const t = setTimeout(() => setDel(true), 2200); return () => clearTimeout(t); }
    if (del && text === "") { const t = setTimeout(() => { setDel(false); setIdx(i => i + 1); }, 400); return () => clearTimeout(t); }
    const speed = del ? 40 : 70;
    const t = setTimeout(() => { setText(del ? text.slice(0, -1) : target.slice(0, text.length + 1)); }, speed);
    return () => clearTimeout(t);
  }, [text, del, idx, phrases]);
  return <span><span className="glow-text">{text}</span><span className="cursor" /></span>;
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-item">
      <button className="faq-question" onClick={() => setOpen(o => !o)}><span>{q}</span><span style={{ color: "var(--neon-red)", fontSize: "1.1rem", flexShrink: 0 }}>{open ? "−" : "+"}</span></button>
      <div className={`faq-answer${open ? " open" : ""}`}>{a}</div>
    </div>
  );
}

function AdminPanel({ open, onClose, apiKey, onSaveKey, onClearKey, apiUrl, onSaveApiUrl }: { open: boolean; onClose: () => void; apiKey: string | null; onSaveKey: (k: string) => void; onClearKey: () => void; apiUrl: string; onSaveApiUrl: (u: string) => void }) {
  const [keyInput, setKeyInput] = useState("");
  const [urlInput, setUrlInput] = useState(apiUrl);
  const [keyError, setKeyError] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  useEffect(() => { setUrlInput(apiUrl); }, [apiUrl]);
  const handleSaveKey = () => {
    const trimmed = keyInput.trim();
    if (!KEY_RE.test(trimmed)) { setKeyError("Must start with sk-or-v1- and be ≥40 chars."); return; }
    setKeyError(""); onSaveKey(trimmed); setKeyInput(""); setKeySaved(true); setTimeout(() => setKeySaved(false), 1800);
  };
  return (
    <>
      <div className={`admin-overlay${open ? " open" : ""}`} onClick={onClose} />
      <aside className={`admin-panel${open ? " open" : ""}`}>
        <div style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <div><div className="section-label" style={{ marginBottom: "0.2rem" }}>Admin Panel</div><div style={{ fontSize: "1rem", fontWeight: 700, color: "#fff" }}>Settings & Keys</div></div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "1.3rem", cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ marginBottom: "2rem" }}>
            <div className="section-label">OpenRouter API Key</div>
            {apiKey && <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}><span className="key-badge">sk-or-v1-…{apiKey.slice(-6)}</span><span style={{ fontSize: "0.65rem", color: "rgba(100,255,100,0.7)" }}>● Active</span></div>}
            {!apiKey && <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}><span style={{ fontSize: "0.65rem", color: "rgba(255,60,60,0.8)" }}>⚠ No key set — evals will fail</span></div>}
            <input type="password" className="cyber-input" value={keyInput} onChange={e => setKeyInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSaveKey()} placeholder="sk-or-v1-…" style={{ marginBottom: "0.5rem" }} />
            {keyError && <p style={{ fontSize: "0.72rem", color: "#f87171", marginBottom: "0.5rem" }}>{keyError}</p>}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="cyber-button cyber-button-fill" onClick={handleSaveKey} style={{ flex: 1, fontSize: "0.65rem" }}>{keySaved ? "✓ Saved" : "Save Key"}</button>
              {apiKey && <button className="cyber-button" onClick={onClearKey} style={{ fontSize: "0.65rem", borderColor: "rgba(255,26,26,0.4)" }}>Clear</button>}
            </div>
            <p style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)", marginTop: "0.75rem", lineHeight: 1.6 }}>Stored in localStorage only. Never sent to any server except the evaluation worker per-request.</p>
          </div>
          <div style={{ marginBottom: "2rem" }}>
            <div className="section-label">Worker API URL</div>
            <input type="text" className="cyber-input" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="http://localhost:8787" style={{ marginBottom: "0.5rem" }} />
            <button className="cyber-button" onClick={() => onSaveApiUrl(urlInput.trim())} style={{ width: "100%", fontSize: "0.65rem" }}>Save URL</button>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,26,26,0.1)", paddingTop: "1.5rem" }}>
            <div className="section-label">Session Info</div>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", lineHeight: 2 }}>
              <div>Key stored: <span style={{ color: apiKey ? "rgba(100,255,100,0.7)" : "rgba(255,60,60,0.7)" }}>{apiKey ? "Yes" : "No"}</span></div>
              <div>Worker URL: <span style={{ color: "rgba(255,26,26,0.6)" }}>{urlInput || "default"}</span></div>
              <div>Version: <span style={{ color: "rgba(255,26,26,0.6)" }}>0.1.0-alpha</span></div>
            </div>
          </div>
          <div className="warning-banner" style={{ marginTop: "2rem" }}><span>⚠</span><span>Authorized security research only. Misuse may be illegal.</span></div>
        </div>
      </aside>
    </>
  );
}

export default function Home() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState(DEFAULT_API);
  const [adminOpen, setAdminOpen] = useState(false);
  const [algorithm, setAlgorithm] = useState<Algorithm>("crescendo");
  const [targetModel, setTargetModel] = useState("anthropic/claude-3-haiku");
  const [attackerModel, setAttackerModel] = useState(FREE_MODELS[0]!);
  const [goal, setGoal] = useState("");
  const [maxTurns, setMaxTurns] = useState(20);
  const [maxRollbacks, setMaxRollbacks] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setApiKey(localStorage.getItem(STORAGE_KEY_API));
    setApiUrl(localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_API);
  }, []);

  const saveKey = (k: string) => { localStorage.setItem(STORAGE_KEY_API, k); setApiKey(k); };
  const clearKey = () => { localStorage.removeItem(STORAGE_KEY_API); setApiKey(null); };
  const saveApiUrl = (u: string) => { localStorage.setItem(STORAGE_KEY_URL, u); setApiUrl(u); };

  const handleSubmit = async () => {
    if (!apiKey) { setError("No API key set. Open admin panel (⚙) to configure."); return; }
    if (!goal.trim()) { setError("Goal is required."); return; }
    setError(""); setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/evals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-openrouter-key": apiKey },
        body: JSON.stringify({ algorithm, targetModel, attackerModel, goal, maxTurns, maxRollbacks }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { evalId } = await res.json();
      router.push(`/eval/${evalId}`);
    } catch (err: any) {
      setError(err.message || "Failed to start eval");
      setSubmitting(false);
    }
  };

  return (
    <>
      <ThreeBackground />
      <FloatingIcons />
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} apiKey={apiKey} onSaveKey={saveKey} onClearKey={clearKey} apiUrl={apiUrl} onSaveApiUrl={saveApiUrl} />
      <div className="relative z-10 min-h-screen">
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/30 border-b border-neon-red/10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-neon-red/10 border border-neon-red/30 rounded flex items-center justify-center text-neon-red font-bold">A</div>
              <span className="text-xl font-bold text-white">AJAR</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#how" className="text-sm text-zinc-400 hover:text-neon-red transition">How It Works</a>
              <a href="#faq" className="text-sm text-zinc-400 hover:text-neon-red transition">FAQ</a>
              <button onClick={() => setAdminOpen(true)} className="cyber-button" style={{ fontSize: "0.7rem", padding: "0.4rem 0.9rem" }}>⚙ Admin</button>
            </div>
          </div>
        </nav>

        <section className="pt-32 pb-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="relative inline-block mb-6">
              <BackgroundBeams />
              <h1 className="text-6xl font-black text-white mb-2 relative z-10"><TextScramble duration={2}>AJAR</TextScramble></h1>
            </div>
            <AnimatedTagline text="Adaptive Jailbreak Auditor & Red-teamer" />
            <p className="text-zinc-400 text-lg mt-6 max-w-2xl mx-auto">Automated multi-turn adversarial probing for AI safety research. <TypingText phrases={["Crescendo escalation", "ActorAttack personas", "X-Teaming strategies"]} /></p>
            {!apiKey && <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm"><span>⚠</span><span>No API key set — open admin panel to configure</span></div>}
          </div>
        </section>

        <section className="py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="cyber-card">
              <div className="section-label mb-6">Launch Evaluation</div>
              <div className="grid gap-6">
                <div><label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">Algorithm</label><select value={algorithm} onChange={e => setAlgorithm(e.target.value as Algorithm)} className="cyber-input">{ALGORITHMS.map(a => <option key={a.value} value={a.value}>{a.label} — {a.desc}</option>)}</select></div>
                <div><label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">Target Model</label><input type="text" value={targetModel} onChange={e => setTargetModel(e.target.value)} placeholder="anthropic/claude-3-haiku" className="cyber-input" /></div>
                <div><label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">Attacker Model</label><select value={attackerModel} onChange={e => setAttackerModel(e.target.value)} className="cyber-input">{FREE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                <div><label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">Attack Goal</label><textarea value={goal} onChange={e => setGoal(e.target.value)} placeholder="Describe the harmful behavior or policy boundary to probe…" rows={4} className="cyber-input" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">Max Turns</label><input type="number" value={maxTurns} onChange={e => setMaxTurns(+e.target.value)} className="cyber-input" /></div>
                  <div><label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wider">Max Rollbacks</label><input type="number" value={maxRollbacks} onChange={e => setMaxRollbacks(+e.target.value)} className="cyber-input" /></div>
                </div>
                {error && <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded px-4 py-2">{error}</div>}
                <button onClick={handleSubmit} disabled={submitting} className="cyber-button cyber-button-fill w-full">{submitting ? "Launching…" : "Launch Eval"}</button>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="py-20 px-6 bg-black/20">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12"><TextScramble>How It Works</TextScramble></h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {STEPS.map(s => <div key={s.n} className="cyber-card"><div className="text-neon-red text-4xl font-black mb-3">{s.n}</div><h3 className="text-white font-bold text-lg mb-2">{s.title}</h3><p className="text-zinc-400 text-sm leading-relaxed">{s.body}</p></div>)}
            </div>
          </div>
        </section>

        <section id="faq" className="py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12"><TextScramble>FAQ</TextScramble></h2>
            <div className="space-y-4">{FAQ.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}</div>
          </div>
        </section>

        <footer className="py-12 px-6 border-t border-neon-red/10 bg-black/30">
          <div className="max-w-5xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-8 bg-neon-red/10 border border-neon-red/30 rounded flex items-center justify-center text-neon-red font-bold">A</div>
              <span className="text-xl font-bold text-white">AJAR</span>
            </div>
            <p className="text-zinc-500 text-sm mb-4">Adaptive Jailbreak Auditor & Red-teamer — TypeScript Edition</p>
            <p className="text-zinc-600 text-xs">Built by Teycir Ben Soltane • Inspired by <a href="https://github.com/douyipu/ajar" target="_blank" rel="noopener" className="text-neon-red hover:underline">AJAR Research</a></p>
            <p className="text-zinc-700 text-xs mt-2">Business Source License 1.1 • Authorized security research only</p>
          </div>
        </footer>
      </div>
    </>
  );
}
