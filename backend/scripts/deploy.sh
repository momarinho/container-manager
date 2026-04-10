#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker command not found" >&2
  exit 1
fi

export IMAGE_NAME="${IMAGE_NAME:-ghcr.io/containermaster/backend}"
export IMAGE_TAG="${IMAGE_TAG:-latest}"

docker compose -f "$COMPOSE_FILE" pull backend
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans backend

"$ROOT_DIR/scripts/wait-for-health.sh"
