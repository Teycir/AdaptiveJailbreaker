#!/bin/bash
set -e

echo "🔐 AJAR Secrets Setup"
echo "====================="

# Load .env if present
if [ -f ".env" ]; then
  set -a; source .env; set +a
fi

# Generate API_INTERNAL_SECRET if not already set
if [ -z "$API_INTERNAL_SECRET" ]; then
  API_INTERNAL_SECRET=$(openssl rand -hex 32)
  echo "🔑 Generated new API_INTERNAL_SECRET"

  # Write it back to .env so it's persisted
  if grep -q "^API_INTERNAL_SECRET=" .env 2>/dev/null; then
    sed -i "s|^API_INTERNAL_SECRET=.*|API_INTERNAL_SECRET=$API_INTERNAL_SECRET|" .env
  else
    echo "API_INTERNAL_SECRET=$API_INTERNAL_SECRET" >> .env
  fi
  echo "✓ Saved to .env"
else
  echo "✓ Using existing API_INTERNAL_SECRET from .env"
fi

# Push to Wrangler
echo "Setting API_INTERNAL_SECRET in Wrangler..."
echo "$API_INTERNAL_SECRET" | npx wrangler secret put API_INTERNAL_SECRET

echo ""
echo "✅ Secrets configured!"
