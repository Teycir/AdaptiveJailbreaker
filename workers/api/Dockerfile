FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY workers/api/package.json ./workers/api/
COPY packages/lib/package.json ./packages/lib/
COPY packages/types/package.json ./packages/types/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages ./packages
COPY workers/api ./workers/api

# Build packages
RUN pnpm --filter @ajar/types build && \
    pnpm --filter @ajar/lib build

# Production stage
FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm wrangler

# Copy built artifacts and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/workers/api ./workers/api
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./

WORKDIR /app/workers/api

EXPOSE 8787

# Use wrangler dev for local mode (supports Ollama)
CMD ["pnpm", "dev", "--port", "8787", "--ip", "0.0.0.0"]
