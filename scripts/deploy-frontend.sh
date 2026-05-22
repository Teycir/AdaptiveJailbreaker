#!/bin/bash
set -e

echo "🌐 AJAR Frontend Deployment"
echo "============================"

# Load .env if present (supports running standalone)
if [ -f ".env" ]; then
  set -a; source .env; set +a
fi

if [ -z "$NEXT_PUBLIC_API_URL" ]; then
  echo "❌ NEXT_PUBLIC_API_URL is not set. Add it to .env."
  exit 1
fi

echo "📡 API URL: $NEXT_PUBLIC_API_URL"

# Build the frontend (NEXT_PUBLIC_API_URL is embedded at build time)
echo "📦 Building frontend..."
cd apps/web
NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  $HOME/.nvm/versions/node/v20.20.0/bin/pnpm build
cd ../..

# Deploy to Cloudflare Pages
echo "🚀 Deploying to Cloudflare Pages..."
npx wrangler pages deploy apps/web/out \
  --project-name=adaptivejailbreaker \
  --commit-dirty=true

echo ""
echo "✅ Frontend deployed!"
echo "🌐 https://adaptivejailbreaker.pages.dev"
