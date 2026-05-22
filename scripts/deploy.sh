#!/bin/bash

echo "🚀 Deploying AJAR to Cloudflare..."

# Use Node 22
source ~/.nvm/nvm.sh
nvm use 22

# Deploy worker with retry
echo "📦 Deploying API Worker..."
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if pnpm deploy:worker; then
    echo "✅ Worker deployed successfully!"
    break
  else
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
      echo "⚠️  Retry $RETRY_COUNT/$MAX_RETRIES in 10s..."
      sleep 10
    else
      echo "❌ Worker deployment failed after $MAX_RETRIES attempts"
      exit 1
    fi
  fi
done

# Deploy pages
echo "🌐 Deploying Pages..."
if pnpm --filter web build && pnpm wrangler pages deploy apps/web/out --project-name=adaptivejailbreaker --branch=main --commit-dirty=true; then
  echo "✅ Pages deployed successfully!"
else
  echo "❌ Pages deployment failed"
  exit 1
fi

echo "✅ Deployment complete!"
