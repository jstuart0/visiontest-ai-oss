#!/bin/bash
set -euo pipefail

echo "================================"
echo "VisionTest.ai - Initial Setup"
echo "================================"
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Error: Node.js is required (v20+). Install from https://nodejs.org"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Error: Docker is required. Install from https://docker.com"; exit 1; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js v20+ required (found $(node -v))"
  exit 1
fi

echo "Prerequisites OK: Node.js $(node -v), Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
echo ""

# Create .env if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
  # Generate random secrets
  JWT_SECRET=$(openssl rand -hex 32)
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^JWT_SECRET=$/JWT_SECRET=$JWT_SECRET/" .env
    sed -i '' "s/^JWT_REFRESH_SECRET=$/JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET/" .env
  else
    sed -i "s/^JWT_SECRET=$/JWT_SECRET=$JWT_SECRET/" .env
    sed -i "s/^JWT_REFRESH_SECRET=$/JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET/" .env
  fi
  echo "Generated JWT secrets automatically."
else
  echo ".env already exists, skipping."
fi

# Start infrastructure
echo ""
echo "Starting PostgreSQL, Redis, and MinIO..."
docker compose up -d

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  HEALTHY=$(docker compose ps --format json 2>/dev/null | grep -c '"healthy"' || true)
  TOTAL=3 # postgres, redis, minio
  if [ "$HEALTHY" -ge "$TOTAL" ]; then
    echo "All services healthy."
    break
  fi
  sleep 2
  WAITED=$((WAITED + 2))
  echo "  Waiting... ($WAITED/${MAX_WAIT}s)"
done

if [ $WAITED -ge $MAX_WAIT ]; then
  echo "Warning: Some services may not be fully healthy. Continuing anyway..."
  docker compose ps
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm ci

# Generate Prisma client
echo ""
echo "Generating Prisma client..."
npm run db:generate

# Run migrations
echo ""
echo "Running database migrations..."
npm run db:migrate

# Seed database
echo ""
echo "Seeding database with sample data..."
npm run db:seed || echo "Seeding may have already been done. Continuing..."

echo ""
echo "================================"
echo "Setup complete!"
echo ""
echo "Start development servers:"
echo "  npm run dev"
echo ""
echo "Default accounts:"
echo "  Admin: admin@visiontest.local / admin123!"
echo "  Demo:  demo@visiontest.local / demo123!"
echo ""
echo "Services:"
echo "  Web:    http://localhost:3000"
echo "  API:    http://localhost:3001"
echo "  MinIO:  http://localhost:9001 (minioadmin/minioadmin)"
echo "================================"
