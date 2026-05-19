#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

DEFAULT_BACKEND_PORT="${BACKEND_HOST_PORT:-3000}"
DEFAULT_FRONTEND_PORT="${FRONTEND_WEB_HOST_PORT:-8081}"

port_is_in_use() {
  local port="$1"
  local output=""

  if command -v ss >/dev/null 2>&1; then
    if output="$(ss -ltn 2>/dev/null)"; then
      printf '%s\n' "$output" | awk '{print $4}' | grep -E "(^|:)$port$" >/dev/null 2>&1
      return
    fi
  fi

  if command -v lsof >/dev/null 2>&1; then
    if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    return 1
  fi

  if command -v netstat >/dev/null 2>&1; then
    if output="$(netstat -ltn 2>/dev/null)"; then
      printf '%s\n' "$output" | awk '{print $4}' | grep -E "(^|:)$port$" >/dev/null 2>&1
      return
    fi
  fi

  echo "Nenhum verificador de porta disponivel (ss/lsof/netstat)." >&2
  exit 1
}

find_available_port() {
  local port="$1"

  while port_is_in_use "$port"; do
    port=$((port + 1))
  done

  echo "$port"
}

BACKEND_PORT="$(find_available_port "$DEFAULT_BACKEND_PORT")"
FRONTEND_PORT="$(find_available_port "$DEFAULT_FRONTEND_PORT")"

if [[ "$BACKEND_PORT" != "$DEFAULT_BACKEND_PORT" ]]; then
  echo "Porta $DEFAULT_BACKEND_PORT ocupada. Backend sera publicado em $BACKEND_PORT."
fi

if [[ "$FRONTEND_PORT" != "$DEFAULT_FRONTEND_PORT" ]]; then
  echo "Porta $DEFAULT_FRONTEND_PORT ocupada. Frontend web sera publicado em $FRONTEND_PORT."
fi

echo "Subindo stack:"
echo "  backend  -> http://localhost:$BACKEND_PORT"
echo "  frontend -> http://localhost:$FRONTEND_PORT"

BACKEND_HOST_PORT="$BACKEND_PORT" \
FRONTEND_WEB_HOST_PORT="$FRONTEND_PORT" \
docker compose up --build "$@"
