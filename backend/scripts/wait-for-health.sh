#!/usr/bin/env bash
set -euo pipefail

APP_HEALTH_URL="${APP_HEALTH_URL:-http://localhost:${PORT:-3000}/health}"
TIMEOUT_SECONDS="${HEALTHCHECK_TIMEOUT_SECONDS:-120}"
INTERVAL_SECONDS="${HEALTHCHECK_INTERVAL_SECONDS:-3}"

elapsed=0

until curl --silent --show-error --fail "$APP_HEALTH_URL" >/dev/null 2>&1; do
  elapsed=$((elapsed + INTERVAL_SECONDS))
  if [ "$elapsed" -ge "$TIMEOUT_SECONDS" ]; then
    echo "Healthcheck timeout after ${TIMEOUT_SECONDS}s: ${APP_HEALTH_URL}" >&2
    exit 1
  fi
  sleep "$INTERVAL_SECONDS"
done

echo "Backend healthy at ${APP_HEALTH_URL}"
