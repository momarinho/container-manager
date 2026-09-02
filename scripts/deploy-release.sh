#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.release.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.release}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$ROOT_DIR/backend/.env}"
STATE_DIR="${DEPLOY_STATE_DIR:-$ROOT_DIR/.deploy_state}"
PREV_STATE_FILE="$STATE_DIR/previous_release.env"

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

# 1. Salvar estado da versão ativa antes da atualização
mkdir -p "$STATE_DIR"

PREV_BACKEND_IMAGE="$(docker inspect --format '{{.Config.Image}}' containermaster-backend 2>/dev/null || true)"
PREV_FRONTEND_IMAGE="$(docker inspect --format '{{.Config.Image}}' containermaster-frontend-web 2>/dev/null || true)"

if [[ -n "$PREV_BACKEND_IMAGE" || -n "$PREV_FRONTEND_IMAGE" ]]; then
  echo "Saving current running release state for potential rollback:"
  echo "  backend:  ${PREV_BACKEND_IMAGE:-none}"
  echo "  frontend: ${PREV_FRONTEND_IMAGE:-none}"
  cat <<EOF > "$PREV_STATE_FILE"
PREV_BACKEND_IMAGE=${PREV_BACKEND_IMAGE}
PREV_FRONTEND_IMAGE=${PREV_FRONTEND_IMAGE}
EOF
fi

# Função de Rollback Automático
rollback() {
  echo "" >&2
  echo "======================================================================" >&2
  echo "CRITICAL ALERT: Health check failed! Initiating automatic rollback..." >&2
  echo "======================================================================" >&2

  if [[ -f "$PREV_STATE_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$PREV_STATE_FILE"
  fi

  if [[ -n "${PREV_BACKEND_IMAGE:-}" || -n "${PREV_FRONTEND_IMAGE:-}" ]]; then
    echo "Reverting containers to previous stable release images:" >&2
    echo "  backend  -> ${PREV_BACKEND_IMAGE:-unchanged}" >&2
    echo "  frontend -> ${PREV_FRONTEND_IMAGE:-unchanged}" >&2

    if [[ -n "${PREV_BACKEND_IMAGE:-}" ]]; then
      export BACKEND_IMAGE_NAME="${PREV_BACKEND_IMAGE%%:*}"
      export BACKEND_IMAGE_TAG="${PREV_BACKEND_IMAGE##*:}"
    fi

    if [[ -n "${PREV_FRONTEND_IMAGE:-}" ]]; then
      export FRONTEND_IMAGE_NAME="${PREV_FRONTEND_IMAGE%%:*}"
      export FRONTEND_IMAGE_TAG="${PREV_FRONTEND_IMAGE##*:}"
    fi

    echo "Deploying previous release containers..." >&2
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans

    echo "Verifying restored release health..." >&2
    local rb_timeout=60
    local rb_backend_healthy=0
    local rb_frontend_healthy=0

    if "$ROOT_DIR/scripts/wait-for-url.sh" "${BACKEND_HEALTH_URL:-http://localhost:${BACKEND_HOST_PORT:-3000}/health}" "$rb_timeout" 2; then
      rb_backend_healthy=1
    fi

    if "$ROOT_DIR/scripts/wait-for-url.sh" "${FRONTEND_HEALTH_URL:-http://localhost:${FRONTEND_WEB_HOST_PORT:-8081}/}" "$rb_timeout" 2; then
      rb_frontend_healthy=1
    fi

    if [[ "$rb_backend_healthy" -eq 1 && "$rb_frontend_healthy" -eq 1 ]]; then
      echo "======================================================================" >&2
      echo "SUCCESS: Rollback complete. Previous stable release restored and healthy." >&2
      echo "======================================================================" >&2
    else
      echo "======================================================================" >&2
      echo "EMERGENCY: Rollback completed but health check did not pass!" >&2
      echo "Manual operator intervention required immediately." >&2
      echo "======================================================================" >&2
    fi
  else
    echo "No previous release recorded in state. Cannot perform automatic rollback." >&2
  fi

  exit 1
}

# 2. Executar deploy da nova versão
echo "Pulling new release images..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull

echo "Starting new release containers..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans

# 3. Executar verificações de saúde (health checks)
BACKEND_HEALTH="${BACKEND_HEALTH_URL:-http://localhost:${BACKEND_HOST_PORT:-3000}/health}"
FRONTEND_HEALTH="${FRONTEND_HEALTH_URL:-http://localhost:${FRONTEND_WEB_HOST_PORT:-8081}/}"
HC_TIMEOUT="${HEALTHCHECK_TIMEOUT_SECONDS:-180}"
HC_INTERVAL="${HEALTHCHECK_INTERVAL_SECONDS:-3}"

echo "Validating health of new release (timeout: ${HC_TIMEOUT}s)..."

if ! "$ROOT_DIR/scripts/wait-for-url.sh" "$BACKEND_HEALTH" "$HC_TIMEOUT" "$HC_INTERVAL"; then
  echo "Backend health check failed on $BACKEND_HEALTH" >&2
  rollback
fi

if ! "$ROOT_DIR/scripts/wait-for-url.sh" "$FRONTEND_HEALTH" "$HC_TIMEOUT" "$HC_INTERVAL"; then
  echo "Frontend health check failed on $FRONTEND_HEALTH" >&2
  rollback
fi

# 4. Atualizar o estado prévio com as novas imagens que acabaram de passar
NEW_BACKEND_IMAGE="$(docker inspect --format '{{.Config.Image}}' containermaster-backend 2>/dev/null || true)"
NEW_FRONTEND_IMAGE="$(docker inspect --format '{{.Config.Image}}' containermaster-frontend-web 2>/dev/null || true)"

cat <<EOF > "$PREV_STATE_FILE"
PREV_BACKEND_IMAGE=${NEW_BACKEND_IMAGE}
PREV_FRONTEND_IMAGE=${NEW_FRONTEND_IMAGE}
EOF

echo "Release deployed successfully."
echo "  backend  -> $BACKEND_HEALTH"
echo "  frontend -> $FRONTEND_HEALTH"
