FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# Generate Prisma client
COPY prisma ./prisma
RUN pnpm exec prisma generate

# Build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# ---------------------------------------------------------------------------
# Runtime image — no devDependencies, no TypeScript compiler
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

# Prisma's linux-musl-openssl-3.0.x engine needs libssl at runtime
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Copy production artifacts only
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# Run as non-root for security
USER node

EXPOSE 3001

# 127.0.0.1, not localhost: Alpine resolves localhost to ::1 first and the
# server listens on IPv4 only
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/v1/healthz || exit 1

CMD ["node", "dist/server.js"]
