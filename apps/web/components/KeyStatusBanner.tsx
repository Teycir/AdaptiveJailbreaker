"use client";

// KeyStatusBanner — replaces KeyGate entirely.
// Polls /key-status on mount and shows an inline warning if keys are
// missing, rate-limited, or exhausted. No user input required.

import { useState, useEffect, useCallback } from "react";

export type KeyStatus = "loading" | "ok" | "degraded" | "down" | "unconfigured";

interface KeyInfo {
  index: number;
  prefix: string;
  status: "ok" | "rate_limited" | "invalid" | "error";
  message?: string;
  retryAfterSecs?: number;
}

export interface StatusData {
  configured: boolean;
  poolSize: number;
  usableKeys: number;
  keys: KeyInfo[];
  warning?: string;
}

function statusColor(s: KeyStatus) {
  return {
    loading:      "rgba(180,180,180,0.6)",
    ok:           "rgba(34,197,94,0.85)",
    degraded:     "rgba(234,179,8,0.9)",
    down:         "rgba(255,80,80,0.9)",
    unconfigured: "rgba(255,80,80,0.9)",
  }[s];
}

function statusDot(s: KeyStatus) {
  return {
    loading:      "#888",
    ok:           "#22c55e",
    degraded:     "#eab308",
    down:         "var(--neon-red, #ff1a1a)",
    unconfigured: "var(--neon-red, #ff1a1a)",
  }[s];
}

function statusLabel(s: KeyStatus, data: StatusData | null) {
  if (s === "loading") return "Checking API keys…";
  if (s === "unconfigured") return "No API keys configured";
  if (!data) return "Unknown";
  if (s === "ok") return `${data.usableKeys}/${data.poolSize} keys healthy`;
  if (s === "degraded") return `${data.usableKeys}/${data.poolSize} keys usable — ${data.poolSize - data.usableKeys} rate-limited`;
  return `All ${data.poolSize} keys exhausted`;
}

export function useKeyStatus(apiUrl: string) {
  const [status, setStatus] = useState<KeyStatus>("loading");
  const [data, setData] = useState<StatusData | null>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  const check = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch(`${apiUrl}/key-status`, { signal: AbortSignal.timeout(12000) });
      const json = await res.json() as StatusData;
      setData(json);
      setLastChecked(Date.now());
      if (!json.configured) setStatus("unconfigured");
      else if (json.usableKeys === 0) setStatus("down");
      else if (json.usableKeys < json.poolSize) setStatus("degraded");
      else setStatus("ok");
    } catch {
      setStatus("down");
      setData(null);
    }
  }, [apiUrl]);

  useEffect(() => { check(); }, [check]);

  return { status, data, lastChecked, refresh: check };
}

interface KeyStatusBannerProps {
  status: KeyStatus;
  data: StatusData | null;
  lastChecked: number | null;
  onRefresh: () => void;
}

export function KeyStatusBanner({ status, data, lastChecked, onRefresh }: KeyStatusBannerProps) {
  // Only show when not fully ok
  if (status === "ok") return null;

  const dot = statusDot(status);
  const color = statusColor(status);
  const label = statusLabel(status, data);

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "0.5rem",
      padding: "0.75rem 1rem",
      background: `${dot}12`,
      border: `1px solid ${dot}44`,
      borderRadius: "0.5rem",
      fontSize: "0.78rem",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0,
            animation: status === "loading" ? "pulse-glow 1s ease-in-out infinite" : "none",
          }} />
          <span style={{ color, fontWeight: 600 }}>{label}</span>
        </div>
        <button onClick={onRefresh} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.35)",
          cursor: "pointer", fontSize: "0.7rem", padding: "0 0.25rem",
        }} title="Re-check keys">↺ re-check</button>
      </div>

      {/* Warning text */}
      {data?.warning && (
        <div style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{data.warning}</div>
      )}

      {/* Per-key breakdown when degraded/down */}
      {data && (status === "degraded" || status === "down") && data.keys.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.25rem" }}>
          {data.keys.map((k) => {
            const kColor = k.status === "ok" ? "#22c55e" : k.status === "rate_limited" ? "#eab308" : "#ff4444";
            return (
              <span key={k.index} title={k.message ?? k.status} style={{
                padding: "0.15rem 0.45rem", borderRadius: "999px",
                background: `${kColor}18`, border: `1px solid ${kColor}44`,
                color: kColor, fontFamily: "monospace", fontSize: "0.65rem",
              }}>
                {k.prefix}… {k.status === "ok" ? "✓" : k.status === "rate_limited" ? "⏱" : "✗"}
              </span>
            );
          })}
        </div>
      )}

      {/* Unconfigured hint */}
      {status === "unconfigured" && (
        <div style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
          Run: <code style={{ color: "rgba(255,200,100,0.8)", background: "rgba(255,255,255,0.05)", padding: "0 0.3rem", borderRadius: 3 }}>
            wrangler secret put GEMINI_API_KEYS
          </code>
        </div>
      )}

      {lastChecked && (
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.62rem" }}>
          Last checked {new Date(lastChecked).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
