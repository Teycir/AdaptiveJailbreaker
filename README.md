# AJAR TypeScript — Adaptive Jailbreaker

Production-grade TypeScript rewrite of the AJAR research prototype, running entirely on Cloudflare's free tier.

**Author:** Teycir Ben Soltane  
**Contact:** teycir@pxdmail.net  
**Inspired by:** [AJAR Research Project](https://github.com/douyipu/ajar)

## 📁 Project Structure

```
ajar-ts/
├── apps/web/              # Next.js 15 frontend (Cloudflare Pages)
├── workers/
│   ├── api/              # Hono API router (Cloudflare Worker)
│   └── engine/           # Eval engine (Durable Object)
├── packages/
│   ├── lib/              # Shared utilities
│   └── types/            # Shared TypeScript types
├── docs/                 # Documentation (specs, roadmaps)
└── scripts/              # Deployment & dev scripts
```

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# First-time deploy (runs migrations, deploys worker + pages, sets secrets)
./scripts/setup.sh

# Subsequent deploys (worker + pages only, no migration step)
./scripts/deploy.sh
```

## 🔑 API Keys

Keys are configured server-side as a `GEMINI_API_KEYS` wrangler secret (comma-separated pool for rate-limit rotation). No key is ever exposed to the browser.

```bash
# Set your Gemini key(s) — comma-separate multiple for pool rotation
wrangler secret put GEMINI_API_KEYS
# paste: AIza...,AIza...
```

Recommended models: `gemini/gemini-2.5-flash-lite` (scorer, fast), `gemini/gemini-2.0-flash` (attacker).

## 📚 Documentation

See [docs/Specs.md](docs/Specs.md) for the full technical specification.

## ✨ Features

- **Zero installation** - Visit URL, start an eval
- **Gemini-powered** - Server-side key pool with 429-rotation
- **Three core algorithms** - Crescendo, ActorAttack, X-Teaming
- **Live streaming** - Real-time eval traces via SSE
- **Cloudflare native** - Pages + Workers + KV + D1 (100% free tier)

## 📄 License

MIT


## 🙏 Acknowledgments

This project is inspired by the original [AJAR research project](https://github.com/douyipu/ajar) by Dou et al.
