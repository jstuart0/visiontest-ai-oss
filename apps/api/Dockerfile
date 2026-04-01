# VisionTest AI - API Service Dockerfile
FROM node:20-alpine AS base

# Build stage - single stage that installs, generates, and builds
FROM base AS builder
WORKDIR /app

# Copy everything needed
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/database/package*.json ./packages/database/

# Install all dependencies (including dev for building)
RUN npm ci

# Copy source files
COPY turbo.json ./
COPY apps/api ./apps/api
COPY packages/database ./packages/database

# Generate Prisma client
WORKDIR /app/packages/database
RUN npx prisma generate

# Build database package
RUN npx tsc

# Build API
WORKDIR /app
RUN npm run build --workspace=@visiontest/api

# Note: We skip npm prune --production because workspace deps get incorrectly removed

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 visiontest

# Copy the entire built workspace (node_modules, dist outputs, etc.)
COPY --from=builder --chown=visiontest:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=visiontest:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=visiontest:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=visiontest:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=visiontest:nodejs /app/packages/database/dist ./packages/database/dist
COPY --from=builder --chown=visiontest:nodejs /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder --chown=visiontest:nodejs /app/package.json ./package.json

USER visiontest

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
