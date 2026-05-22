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

# Deploy to Cloudflare
cd workers/api && wrangler deploy
```

## 📚 Documentation

See [docs/Specs.md](docs/Specs.md) for the full technical specification.

## 🔑 Features

- **Zero installation** - Visit URL, paste OpenRouter key, run
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
