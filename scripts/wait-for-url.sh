#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${1:-}"
TIMEOUT_SECONDS="${2:-${HEALTHCHECK_TIMEOUT_SECONDS:-180}}"
INTERVAL_SECONDS="${3:-${HEALTHCHECK_INTERVAL_SECONDS:-3}}"

if [[ -z "$TARGET_URL" ]]; then
  echo "Usage: $0 <url> [timeout_seconds] [interval_seconds]" >&2
  exit 1
fi

elapsed=0

until curl --silent --show-error --fail "$TARGET_URL" >/dev/null 2>&1; do
  elapsed=$((elapsed + INTERVAL_SECONDS))
  if [[ "$elapsed" -ge "$TIMEOUT_SECONDS" ]]; then
    echo "Healthcheck timeout after ${TIMEOUT_SECONDS}s: ${TARGET_URL}" >&2
    exit 1
  fi
  sleep "$INTERVAL_SECONDS"
done

echo "Endpoint healthy at ${TARGET_URL}"
