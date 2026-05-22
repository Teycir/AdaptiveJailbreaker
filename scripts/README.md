# Scripts

Deployment and development scripts:

## deploy.sh
Deploys the AJAR API Worker to Cloudflare:
- Installs dependencies
- Creates D1 database
- Deploys API Worker

Usage:
```bash
bash scripts/deploy.sh
```

## setup-secrets.sh
Configures required secrets:
- Generates and sets API_INTERNAL_SECRET

Usage:
```bash
bash scripts/setup-secrets.sh
```

## deploy-frontend.sh
Builds and deploys the Next.js frontend:
- Builds the web app
- Deploys to Cloudflare Pages

Usage:
```bash
bash scripts/deploy-frontend.sh
```

## setup.sh
Initial project setup:
- Verifies Wrangler authentication
- Runs deployment

Usage:
```bash
bash scripts/setup.sh
```
