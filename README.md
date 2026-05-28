# AJAR TypeScript — Adaptive Jailbreaker

Production-grade TypeScript rewrite of the AJAR research prototype, running entirely on Cloudflare's free tier.

**Author:** Teycir Ben Soltane  
**Contact:** teycir@pxdmail.net  
**Inspired by:** [AJAR Research Project](https://github.com/douyipu/ajar)

## 🎯 Results

AJAR achieves state-of-the-art jailbreak success rates through adaptive multi-turn attacks:

- **Crescendo**: Gradual escalation from benign to harmful requests (70-85% ASR)
- **ActorAttack**: Role-playing scenarios to bypass safety filters (65-80% ASR)
- **X-Teaming**: Multi-agent collaboration for complex jailbreaks (75-90% ASR)

All algorithms adapt in real-time based on target model responses, automatically adjusting strategy when defenses are detected.

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

AJAR supports **any LLM provider** via server-side key pools with automatic rate-limit rotation. Keys are stored as wrangler secrets and never exposed to the browser.

```bash
# Set API keys for any provider — comma-separate multiple keys for pool rotation
wrangler secret put GEMINI_API_KEYS      # Google Gemini
wrangler secret put OPENAI_API_KEYS      # OpenAI GPT models
wrangler secret put ANTHROPIC_API_KEYS   # Anthropic Claude
# Add as many providers as needed
```

**Recommended configuration:**
- **Scorer** (fast, cheap): `gemini/gemini-2.5-flash-lite` or `openai/gpt-4o-mini`
- **Attacker** (creative): `gemini/gemini-2.0-flash` or `anthropic/claude-3-5-sonnet`
- **Target**: Any model you want to test

The system automatically rotates through your key pool when hitting rate limits (429 errors).

## 📚 Documentation

See [docs/Specs.md](docs/Specs.md) for the full technical specification.

## ✨ Features

- **Zero installation** - Visit URL, start an eval
- **Multi-provider support** - OpenAI, Anthropic, Gemini, and more with automatic key rotation
- **Three core algorithms** - Crescendo, ActorAttack, X-Teaming
- **Live streaming** - Real-time eval traces via SSE
- **Cloudflare native** - Pages + Workers + KV + D1 (100% free tier)

## 📄 License

Business Source License 1.1 (BSL)

- **License Date:** 2026
- **Change Date:** Four years from the license date

See [LICENSE](LICENSE) for full details.

## 🙏 Acknowledgments

This project is inspired by the original [AJAR research project](https://github.com/douyipu/ajar) by Dou et al.
