#!/bin/bash
set -e

echo "🔧 AJAR Setup Script"
echo "===================="

# Load .env
if [ -f ".env" ]; then
  echo "📄 Loading environment from .env..."
  set -a; source .env; set +a
else
  echo "❌ No .env file found — copy .env.example to .env and fill in your values"
  exit 1
fi

# Check required vars
MISSING=()
[ -z "$CLOUDFLARE_ACCOUNT_ID" ] && MISSING+=("CLOUDFLARE_ACCOUNT_ID")
[ -z "$D1_DATABASE_ID" ]        && MISSING+=("D1_DATABASE_ID")
[ -z "$OPENROUTER_API_KEY" ]    && MISSING+=("OPENROUTER_API_KEY")
[ -z "$API_WORKER_URL" ]        && MISSING+=("API_WORKER_URL")
[ -z "$NEXT_PUBLIC_API_URL" ]   && MISSING+=("NEXT_PUBLIC_API_URL")

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "❌ Missing required env vars: ${MISSING[*]}"
  exit 1
fi

echo "✓ Environment loaded"

# Check Wrangler auth
echo "Checking Wrangler authentication..."
if ! npx wrangler whoami &>/dev/null; then
  echo "❌ Not logged in to Wrangler. Run: npx wrangler login"
  exit 1
fi
echo "✓ Wrangler authenticated"

# Run full deployment
./scripts/deploy.sh
./scripts/setup-secrets.sh
./scripts/deploy-frontend.sh

echo ""
echo "🎉 AJAR fully deployed!"
echo "   API:      $API_WORKER_URL"
echo "   Frontend: https://adaptivejailbreaker.pages.dev"
