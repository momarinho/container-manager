#!/usr/bin/env bash
set -euo pipefail

# Teste automatizado para verificar o mecanismo de Rollback Automático do deploy-release.sh
TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT

echo "Iniciando teste de Rollback Automático em $TEST_DIR..."

MOCK_BIN="$TEST_DIR/bin"
mkdir -p "$MOCK_BIN"
mkdir -p "$TEST_DIR/backend"
mkdir -p "$TEST_DIR/scripts"

# Mock do docker-compose.release.yml e .env.release
cat << 'EOF' > "$TEST_DIR/docker-compose.release.yml"
services:
  backend:
    image: ${BACKEND_IMAGE_NAME}:${BACKEND_IMAGE_TAG}
  frontend-web:
    image: ${FRONTEND_IMAGE_NAME}:${FRONTEND_IMAGE_TAG}
EOF

cat << 'EOF' > "$TEST_DIR/.env.release"
BACKEND_IMAGE_NAME=containermaster-backend
BACKEND_IMAGE_TAG=v2
FRONTEND_IMAGE_NAME=containermaster-frontend-web
FRONTEND_IMAGE_TAG=v2
BACKEND_HOST_PORT=3000
FRONTEND_WEB_HOST_PORT=8081
BACKEND_HEALTH_URL=http://localhost:3000/health
FRONTEND_HEALTH_URL=http://localhost:8081/
HEALTHCHECK_TIMEOUT_SECONDS=2
HEALTHCHECK_INTERVAL_SECONDS=1
EOF

touch "$TEST_DIR/backend/.env"

# Mock do docker CLI
cat << 'EOF' > "$MOCK_BIN/docker"
#!/usr/bin/env bash
if [[ "$1" == "inspect" ]]; then
  container_name="$4"
  if [[ "$container_name" == "containermaster-backend" ]]; then
    echo "containermaster-backend:v1-stable"
  elif [[ "$container_name" == "containermaster-frontend-web" ]]; then
    echo "containermaster-frontend-web:v1-stable"
  fi
  exit 0
elif [[ "$1" == "compose" ]]; then
  echo "[MOCK DOCKER COMPOSE] $@" >> "$TEST_LOG"
  exit 0
fi
exit 0
EOF
chmod +x "$MOCK_BIN/docker"

# Mock do wait-for-url.sh que simula falha no novo deploy
cat << 'EOF' > "$TEST_DIR/scripts/wait-for-url.sh"
#!/usr/bin/env bash
# Se a variável de ambiente do rollback foi ativada, passa; senão simula falha
if [[ "${BACKEND_IMAGE_TAG:-}" == "v1-stable" ]]; then
  echo "[MOCK HEALTHCHECK] Restored stable release passed health check!" >> "$TEST_LOG"
  exit 0
fi

echo "[MOCK HEALTHCHECK] Simulating new release timeout / health failure!" >> "$TEST_LOG"
exit 1
EOF
chmod +x "$TEST_DIR/scripts/wait-for-url.sh"

export TEST_LOG="$TEST_DIR/test_run.log"
touch "$TEST_LOG"

# Copiar deploy-release.sh para o ambiente de teste
cp "$(dirname "${BASH_SOURCE[0]}")/deploy-release.sh" "$TEST_DIR/scripts/deploy-release.sh"
chmod +x "$TEST_DIR/scripts/deploy-release.sh"

# Executar deploy com PATH apontando para o mock do docker
set +e
PATH="$MOCK_BIN:$PATH" "$TEST_DIR/scripts/deploy-release.sh" > "$TEST_DIR/output.log" 2>&1
EXIT_CODE=$?
set -e

# Validar que o script retornou erro (1) indicando falha na release nova
if [[ "$EXIT_CODE" -ne 1 ]]; then
  echo "FALHA: deploy-release.sh deveria retornar exit code 1, mas retornou $EXIT_CODE" >&2
  cat "$TEST_DIR/output.log"
  exit 1
fi

# Validar que a rotina de rollback foi acionada
if ! grep -q "Initiating automatic rollback" "$TEST_DIR/output.log"; then
  echo "FALHA: Alerta de início de rollback não foi encontrado no log!" >&2
  cat "$TEST_DIR/output.log"
  exit 1
fi

# Validar que a versão restaurada foi a estável v1
if ! grep -q "Reverting containers to previous stable release images" "$TEST_DIR/output.log"; then
  echo "FALHA: Reversão de imagens não foi executada!" >&2
  cat "$TEST_DIR/output.log"
  exit 1
fi

if ! grep -q "Rollback complete. Previous stable release restored and healthy." "$TEST_DIR/output.log"; then
  echo "FALHA: Rollback não concluiu com sucesso!" >&2
  cat "$TEST_DIR/output.log"
  exit 1
fi

echo "SUCESSO: Teste de Rollback Automático validado com 100% de precisão!"
