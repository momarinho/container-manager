#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.release.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.release}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$ROOT_DIR/backend/.env}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker command not found" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Release env file not found: $ENV_FILE" >&2
  echo "Create it from .env.release.example before deploying." >&2
  exit 1
fi

if [[ ! -f "$BACKEND_ENV_FILE" ]]; then
  echo "Backend env file not found: $BACKEND_ENV_FILE" >&2
  echo "Create it from backend/.env.example before deploying." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans

"$ROOT_DIR/scripts/wait-for-url.sh" "${BACKEND_HEALTH_URL:-http://localhost:${BACKEND_HOST_PORT:-3000}/health}"
"$ROOT_DIR/scripts/wait-for-url.sh" "${FRONTEND_HEALTH_URL:-http://localhost:${FRONTEND_WEB_HOST_PORT:-8081}/}"

echo "Release deployed successfully."
echo "  backend  -> ${BACKEND_HEALTH_URL:-http://localhost:${BACKEND_HOST_PORT:-3000}/health}"
echo "  frontend -> ${FRONTEND_HEALTH_URL:-http://localhost:${FRONTEND_WEB_HOST_PORT:-8081}/}"
