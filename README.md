# VisionTest AI

**AI-powered visual regression testing platform.** Catch unintended UI changes before your users do.

[![CI](https://github.com/visiontest-ai/visiontest-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/visiontest-ai/visiontest-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

VisionTest AI automates visual regression testing by capturing screenshots of your web applications, comparing them against approved baselines using both pixel-level and AI-powered perceptual analysis, and surfacing diffs through an approval workflow. It runs in your infrastructure -- your data never leaves your network.

## Features

**Visual Testing**
- Pixel-level screenshot comparison with configurable diff thresholds
- AI-powered 4-stage diff cascade: SSIM, LPIPS, DINOv2, and VLM analysis
- Multi-browser support: Chromium, Firefox, WebKit
- Device emulation for mobile viewports
- Ignore masks (rectangle, CSS selector, XPath, regex) for dynamic content
- Video recording of test executions

**AI & Automation**
- Natural language test creation with LLM fallback for complex instructions
- Autonomous bug-fix pipeline: investigate, classify, patch, verify, deliver
- Self-healing selectors with 4-strategy cascade (cache, DOM, heuristic, LLM)
- Flaky test detection with automatic quarantine and scoring
- Smart test selection with source-to-test impact mapping
- Storybook integration with automatic component discovery and polling sync
- Multi-provider AI: Anthropic, OpenAI, OpenRouter, Gemini, Local/Ollama

**Workflow**
- Approval workflows with review chains by severity, component, or team
- Live browser streaming via CDP screencast
- Scheduled test execution with cron and timezone support
- Replay from failure with checkpoint state
- API testing with assertions and environment management
- Webhook notifications and REST API for CI/CD integration
- Multi-tenant: Organizations, projects, teams with RBAC

## Quick Start

```bash
git clone https://github.com/visiontest-ai/visiontest-ai.git
cd visiontest-ai
./scripts/setup.sh
npm run dev
```

This starts PostgreSQL, Redis, and MinIO via Docker Compose, runs migrations, seeds sample data, and launches the development servers.

**Default accounts:**
- Admin: `admin@visiontest.local` / `admin123!`
- Demo: `demo@visiontest.local` / `demo123!`

**URLs:**
- Web UI: http://localhost:3000
- API: http://localhost:3001/api/v1
- MinIO Console: http://localhost:9001

## Installation Options

### One-Command Install

```bash
# Interactive (choose dev, docker, or helm)
curl -fsSL https://raw.githubusercontent.com/visiontest-ai/visiontest-ai/main/install.sh | bash

# Or with a flag
./install.sh --dev        # Local development
./install.sh --docker     # Docker Compose production
./install.sh --helm       # Helm chart to Kubernetes
```

### Docker Compose (Production)

```bash
docker build --platform linux/amd64 -t visiontest-api -f Dockerfile.api .
docker build --platform linux/amd64 -t visiontest-web -f Dockerfile.web .
docker build --platform linux/amd64 -t visiontest-worker -f Dockerfile.worker .
docker build --platform linux/amd64 -t visiontest-embeddings -f services/embeddings/Dockerfile services/embeddings/
docker compose up -d
```

### Helm (Kubernetes)

```bash
helm upgrade --install visiontest ./charts/visiontest \
  --namespace visiontest --create-namespace \
  --set secrets.databaseUrl="postgresql://..." \
  --set secrets.jwtSecret="$(openssl rand -hex 32)" \
  --set secrets.jwtRefreshSecret="$(openssl rand -hex 32)" \
  --set ingress.hosts.web="visiontest.yourdomain.com"
```

See [`charts/visiontest/values.yaml`](charts/visiontest/values.yaml) for all configuration options.

### Kustomize

```bash
kubectl apply -k k8s/overlays/production/
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Next.js   │────>│  Express +  │────>│  Playwright   │
│   Frontend  │     │  Socket.IO  │     │   Worker      │
│  (apps/web) │<────│  (apps/api) │<────│ (apps/worker) │
└─────────────┘     └──────┬──────┘     └───────┬───────┘
                           │                     │
                    ┌──────┴──────┐       ┌──────┴───────┐
                    │ PostgreSQL  │       │    MinIO      │
                    │  (Prisma)   │       │ (Screenshots) │
                    └─────────────┘       └──────────────┘
                           │
                    ┌──────┴──────┐     ┌───────────────┐
                    │   Redis     │     │  Embeddings   │
                    │(BullMQ/SSE) │     │  (FastAPI)    │
                    └─────────────┘     │ SSIM/LPIPS/   │
                                        │ DINOv2        │
                                        └───────────────┘
```

**Monorepo structure:**
```
apps/
  api/          Express + Socket.IO API server (TypeScript)
  web/          Next.js 14 frontend (App Router, shadcn/ui)
  worker/       BullMQ worker with Playwright test execution
packages/
  database/     Prisma schema, client, migrations, shared services
  types/        Shared TypeScript types
services/
  embeddings/   Python FastAPI sidecar for AI visual diff (SSIM, LPIPS, DINOv2)
```

## Configuration

Copy `.env.example` to `.env`. The setup script generates JWT secrets automatically. See `.env.example` for all available options.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | JWT refresh token secret (min 32 chars) |
| `MINIO_ENDPOINT` | No | MinIO host (default: `localhost`) |
| `CORS_ORIGIN` | No | Allowed CORS origin (default: `http://localhost:3000`) |
| `WORKER_CONCURRENCY` | No | Parallel test executions (default: `2`) |
| `ANTHROPIC_API_KEY` | No | Enables AI-powered features |

## Development

```bash
docker compose up -d          # Start infrastructure
npm ci                        # Install dependencies
npm run db:generate           # Generate Prisma client
npm run db:migrate            # Run migrations
npm run dev                   # Start all apps

npm test                      # Run tests
npx tsc --noEmit --project apps/api/tsconfig.json     # Type check API
npx tsc --noEmit --project apps/worker/tsconfig.json   # Type check Worker
```

## Security

- JWT tokens with algorithm pinning (HS256) and minimum secret length enforcement
- Refresh token isolation -- rejected by access-only endpoints
- SSRF protection on all server-side fetch paths (fail-closed, IPv4+IPv6)
- Redis-backed rate limiting with per-user keying
- AES-256-GCM encryption for stored API keys and repository tokens
- bcrypt-hashed API keys with prefix-based lookup
- Role-based access control (Owner, Admin, Member, Viewer)
- Non-root containers with Kubernetes NetworkPolicies
- Helmet security headers and CORS configuration
- WebSocket authentication with per-event org membership checks

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow and guidelines.

## License

[MIT](LICENSE)
