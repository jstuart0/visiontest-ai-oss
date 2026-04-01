# CLAUDE.md - VisionTest AI

## Repository Overview

This is **VisionTest AI**, an AI-powered visual regression testing platform. Open-source under the MIT license.

## Architecture

Turborepo monorepo with three apps and shared packages:

```
apps/
  api/          Express + Socket.IO API server (TypeScript)
  web/          Next.js 14 frontend (App Router, React, Tailwind, shadcn/ui)
  worker/       BullMQ worker with Playwright test execution (TypeScript)
packages/
  database/     Prisma schema, client, migrations, and shared services (PostgreSQL)
  types/        Shared TypeScript types
services/
  embeddings/   Python FastAPI sidecar for SSIM/LPIPS/DINOv2 (AI visual diff)
```

## Development

```bash
# Quick start
./scripts/setup.sh

# Manual start
docker compose up -d          # PostgreSQL, Redis, MinIO
npm install
npm run dev                   # Starts all apps via turbo
```

## Key Technical Details

### API (apps/api)
- Express with routes at `/api/v1/*`
- JWT authentication via `authenticate` middleware
- Socket.IO for live browser streaming (authenticated)
- BullMQ queue `test-execution` connects API to Worker
- SSE endpoint for step progress streaming

### Web (apps/web)
- Next.js App Router with route groups: `(auth)` and `(dashboard)`
- Auth: JWT stored in localStorage, zustand persist
- API client in `src/lib/api.ts` wraps `{ success, data }` responses

### Worker (apps/worker)
- BullMQ consumer processing: test executions, AI diff analysis, fix sessions, API tests, storybook sync
- Playwright for browser automation (Chromium, Firefox, WebKit)
- AI service supporting 5 LLM providers (Anthropic, OpenAI, OpenRouter, Gemini, Local)

### Database (packages/database)
- PostgreSQL via Prisma ORM
- Shared services: crypto (AES-256-GCM), storybook sync, impact mappings
- Key distinction: Test.status = entity status (ACTIVE/DISABLED), Execution.status = run status (PASSED/FAILED)

## Type Checking

```bash
cd apps/api && npx tsc --noEmit
cd apps/worker && npx tsc --noEmit
cd apps/web && npx next build
```

## Common Gotchas

1. **NEXT_PUBLIC_* vars**: Baked at Docker build time, not runtime
2. **Socket.IO URL**: Must connect to root host (no /api prefix)
3. **API response wrapper**: All responses are `{ success: true, data: {...} }` -- the client auto-unwraps
4. **Auth state**: Three storage locations -- `auth_token`, `auth_user`, `auth-storage` (zustand)
5. **lightningcss**: Needs platform-specific binary -- `darwin-arm64` for local dev, `linux-x64-gnu` in Dockerfile
