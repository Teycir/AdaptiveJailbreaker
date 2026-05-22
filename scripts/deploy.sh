#!/bin/bash
set -e

echo "🚀 AJAR API Deployment"
echo "======================"

# Load .env if present (supports running standalone)
if [ -f ".env" ]; then
  set -a; source .env; set +a
fi

# Create D1 database if it doesn't exist
echo "🗄️  Ensuring D1 database exists..."
if npx wrangler d1 info ajar-db &>/dev/null; then
  echo "✓ D1 database exists"
else
  echo "Creating D1 database..."
  npx wrangler d1 create ajar-db
  echo "✓ D1 database created"
fi

# Apply D1 migrations (--migrations-dir is the correct flag, not wrangler.toml field)
echo "🗄️  Applying D1 migrations..."
npx wrangler d1 migrations apply ajar-db --remote --migrations-dir migrations
echo "✓ D1 migrations applied"

# Push OPENROUTER_API_KEY as a Wrangler secret if set in env
if [ -n "$OPENROUTER_API_KEY" ]; then
  echo "🔑 Pushing OPENROUTER_API_KEY secret..."
  echo "$OPENROUTER_API_KEY" | npx wrangler secret put OPENROUTER_API_KEY
  echo "✓ OPENROUTER_API_KEY set"
fi

# Deploy API Worker
echo "🔧 Deploying API Worker..."
npx wrangler deploy

echo ""
echo "✅ API deployed: $API_WORKER_URL"
