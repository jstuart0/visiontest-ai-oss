#!/usr/bin/env bash
set -euo pipefail

# VisionTest AI - One-Command Installer
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/visiontest-ai/visiontest-ai/main/install.sh | bash
#   OR
#   ./install.sh              # interactive mode (default)
#   ./install.sh --docker     # Docker Compose (production)
#   ./install.sh --helm       # Helm chart install
#   ./install.sh --dev        # Local development setup

REPO="https://github.com/visiontest-ai/visiontest-ai.git"
INSTALL_DIR="${INSTALL_DIR:-visiontest-ai}"
HELM_RELEASE="${HELM_RELEASE:-visiontest}"
HELM_NAMESPACE="${HELM_NAMESPACE:-visiontest}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
die()   { err "$@"; exit 1; }

banner() {
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║        VisionTest AI Installer       ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
  echo ""
}

# -------------------------------------------------------------------
# Prerequisite checks
# -------------------------------------------------------------------

has() { command -v "$1" >/dev/null 2>&1; }

require_docker() {
  has docker   || die "Docker is required. Install from https://docs.docker.com/get-docker/"
  docker info >/dev/null 2>&1 || die "Docker daemon is not running."
  has docker && docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."
  ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
}

require_node() {
  has node || die "Node.js 20+ is required. Install from https://nodejs.org"
  local v
  v=$(node -v | sed 's/v//' | cut -d. -f1)
  [ "$v" -ge 20 ] || die "Node.js 20+ required (found $(node -v))"
  ok "Node.js $(node -v)"
}

require_helm() {
  has helm || die "Helm 3 is required. Install from https://helm.sh/docs/intro/install/"
  ok "Helm $(helm version --short 2>/dev/null || echo '3.x')"
}

require_kubectl() {
  has kubectl || die "kubectl is required. Install from https://kubernetes.io/docs/tasks/tools/"
  kubectl cluster-info >/dev/null 2>&1 || die "kubectl cannot reach a cluster. Check your kubeconfig."
  ok "kubectl connected to $(kubectl config current-context)"
}

# -------------------------------------------------------------------
# Shared helpers
# -------------------------------------------------------------------

clone_repo() {
  if [ -d "$INSTALL_DIR/.git" ]; then
    info "Repository already cloned at ./$INSTALL_DIR"
  else
    info "Cloning repository..."
    git clone "$REPO" "$INSTALL_DIR"
    ok "Cloned to ./$INSTALL_DIR"
  fi
  cd "$INSTALL_DIR"
}

generate_secret() { openssl rand -hex 32; }

create_env() {
  if [ -f .env ]; then
    info ".env already exists, skipping generation."
    return
  fi
  info "Creating .env from template..."
  cp .env.example .env

  local jwt_secret jwt_refresh encryption_key
  jwt_secret=$(generate_secret)
  jwt_refresh=$(generate_secret)
  encryption_key=$(generate_secret)

  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|^JWT_SECRET=$|JWT_SECRET=$jwt_secret|" .env
    sed -i '' "s|^JWT_REFRESH_SECRET=$|JWT_REFRESH_SECRET=$jwt_refresh|" .env
  else
    sed -i "s|^JWT_SECRET=$|JWT_SECRET=$jwt_secret|" .env
    sed -i "s|^JWT_REFRESH_SECRET=$|JWT_REFRESH_SECRET=$jwt_refresh|" .env
  fi
  ok "Generated secrets automatically."
}

# -------------------------------------------------------------------
# Install modes
# -------------------------------------------------------------------

install_dev() {
  info "Installing for local development..."
  echo ""
  require_docker
  require_node
  echo ""

  clone_repo
  create_env

  info "Starting infrastructure (PostgreSQL, Redis, MinIO)..."
  docker compose up -d

  info "Waiting for services to be healthy..."
  local waited=0
  while [ $waited -lt 60 ]; do
    local healthy
    healthy=$(docker compose ps --format json 2>/dev/null | grep -c '"healthy"' || true)
    [ "$healthy" -ge 3 ] && break
    sleep 2
    waited=$((waited + 2))
  done

  info "Installing dependencies..."
  npm ci

  info "Generating Prisma client..."
  npm run db:generate

  info "Running database migrations..."
  npm run db:migrate

  info "Seeding sample data..."
  npm run db:seed 2>/dev/null || true

  echo ""
  ok "Development environment ready!"
  echo ""
  echo -e "  Start servers:  ${BOLD}npm run dev${NC}"
  echo ""
  echo "  Web UI:        http://localhost:3000"
  echo "  API:           http://localhost:3001/api/v1"
  echo "  MinIO Console: http://localhost:9001"
  echo ""
  echo "  Default accounts:"
  echo "    admin@visiontest.local / admin123!"
  echo "    demo@visiontest.local  / demo123!"
}

install_docker() {
  info "Installing with Docker Compose (production)..."
  echo ""
  require_docker
  echo ""

  clone_repo
  create_env

  info "Building container images..."
  docker build --platform linux/amd64 -t visiontest-api -f Dockerfile.api .
  docker build --platform linux/amd64 -t visiontest-web -f Dockerfile.web .
  docker build --platform linux/amd64 -t visiontest-worker -f Dockerfile.worker .
  docker build --platform linux/amd64 -t visiontest-embeddings -f services/embeddings/Dockerfile services/embeddings/

  info "Starting all services..."
  docker compose up -d

  info "Waiting for infrastructure..."
  sleep 10

  info "Running database migrations..."
  docker compose exec api npx prisma migrate deploy 2>/dev/null || {
    warn "Migration via exec failed. Trying direct..."
    npm ci --ignore-scripts
    npm run db:generate
    npm run db:migrate
  }

  echo ""
  ok "Production deployment ready!"
  echo ""
  echo "  Configure CORS_ORIGIN and NEXT_PUBLIC_API_URL in .env for your domain."
  echo "  Then restart: docker compose restart"
}

install_helm() {
  info "Installing with Helm chart..."
  echo ""
  require_helm
  require_kubectl
  echo ""

  clone_repo

  local db_url redis_url jwt_secret jwt_refresh minio_ak minio_sk encryption_key
  jwt_secret=$(generate_secret)
  jwt_refresh=$(generate_secret)
  encryption_key=$(generate_secret)

  echo ""
  echo -e "${BOLD}Configure required values:${NC}"
  echo ""

  read -rp "PostgreSQL URL [postgresql://postgres:postgres@postgres:5432/visiontest]: " db_url
  db_url="${db_url:-postgresql://postgres:postgres@postgres:5432/visiontest}"

  read -rp "Redis URL [redis://redis:6379]: " redis_url
  redis_url="${redis_url:-redis://redis:6379}"

  read -rp "MinIO Access Key [minioadmin]: " minio_ak
  minio_ak="${minio_ak:-minioadmin}"

  read -rp "MinIO Secret Key [minioadmin]: " minio_sk
  minio_sk="${minio_sk:-minioadmin}"

  read -rp "Ingress hostname [visiontest.example.com]: " ingress_host
  ingress_host="${ingress_host:-visiontest.example.com}"

  read -rp "Ingress class [nginx]: " ingress_class
  ingress_class="${ingress_class:-nginx}"

  echo ""
  info "Installing Helm chart into namespace $HELM_NAMESPACE..."

  helm upgrade --install "$HELM_RELEASE" ./charts/visiontest \
    --namespace "$HELM_NAMESPACE" --create-namespace \
    --set secrets.databaseUrl="$db_url" \
    --set secrets.redisUrl="$redis_url" \
    --set secrets.jwtSecret="$jwt_secret" \
    --set secrets.jwtRefreshSecret="$jwt_refresh" \
    --set secrets.minioAccessKey="$minio_ak" \
    --set secrets.minioSecretKey="$minio_sk" \
    --set secrets.encryptionKey="$encryption_key" \
    --set ingress.hosts.web="$ingress_host" \
    --set ingress.hosts.api="api.$ingress_host" \
    --set ingress.className="$ingress_class" \
    --wait --timeout 5m

  echo ""
  ok "Helm release '$HELM_RELEASE' installed in namespace '$HELM_NAMESPACE'."
  echo ""
  echo "  Check status:  helm status $HELM_RELEASE -n $HELM_NAMESPACE"
  echo "  View pods:     kubectl get pods -n $HELM_NAMESPACE"
  echo ""
  echo "  Web UI:  https://$ingress_host"
  echo "  API:     https://api.$ingress_host"
}

# -------------------------------------------------------------------
# Interactive mode
# -------------------------------------------------------------------

interactive() {
  echo "How would you like to install VisionTest AI?"
  echo ""
  echo "  1) Local Development  -- Node.js + Docker Compose (infra only)"
  echo "  2) Docker Compose     -- Full production stack in containers"
  echo "  3) Helm (Kubernetes)  -- Deploy to a Kubernetes cluster"
  echo ""
  read -rp "Choice [1]: " choice
  choice="${choice:-1}"

  case "$choice" in
    1) install_dev ;;
    2) install_docker ;;
    3) install_helm ;;
    *) die "Invalid choice: $choice" ;;
  esac
}

# -------------------------------------------------------------------
# Main
# -------------------------------------------------------------------

main() {
  banner

  case "${1:-}" in
    --dev)    install_dev ;;
    --docker) install_docker ;;
    --helm)   install_helm ;;
    --help|-h)
      echo "Usage: $0 [--dev|--docker|--helm]"
      echo ""
      echo "  --dev     Local development (Node.js + Docker infra)"
      echo "  --docker  Docker Compose production deployment"
      echo "  --helm    Helm chart install to Kubernetes"
      echo ""
      echo "  No flag = interactive mode"
      exit 0
      ;;
    "") interactive ;;
    *)  die "Unknown option: $1. Use --help for usage." ;;
  esac
}

main "$@"
