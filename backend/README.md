# ContainerMaster Backend

Backend FastAPI do Container Manager, responsável por autenticação, integração com Docker, métricas do host, terminal, logs e status de túnel.

## Recursos implementados

- `GET /health`
- `POST /api/auth/login`
- `GET|POST /api/auth/validate`
- `GET /api/auth/verify`
- `GET /api/containers`
- `POST /api/containers`
- `POST /api/containers/validate-image`
- `GET /api/containers/:id`
- `POST /api/containers/:id/start|stop|restart|pause|unpause`
- `DELETE /api/containers/:id`
- `GET /api/containers/:id/stats`
- `POST /api/containers/:id/exec`
- `GET /api/system/stats`
- `GET /api/system/stats/history`
- `GET /api/system/info`
- `GET /api/tunnel/status`
- `POST /api/tunnel/connect`
- `POST /api/tunnel/disconnect`
- `WS /ws/stats`
- `WS /ws/logs/:containerId`
- `WS /ws/terminal/:containerId`
- `WS /ws/tunnel`

Swagger em `GET /docs`.

## Desenvolvimento local

```bash
cp .env.example .env
python -m venv .venv
. .venv/bin/activate
pip install -e .
uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
```

## Desenvolvimento com Docker

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Stack completa pela raiz

```bash
cd ..
cp .env.example .env
cp backend/.env.example backend/.env
./scripts/docker-up.sh
```

Isso sobe o backend em `http://localhost:3000` e o frontend web em `http://localhost:8081`.
Nessa stack, o backend roda com reload e acesso direto ao socket Docker do host para desenvolvimento local.

Se `3000` ou `8081` já estiverem ocupadas, o script procura a proxima porta livre automaticamente.

Para fixar portas manualmente no `.env` da raiz:

```bash
BACKEND_HOST_PORT=3001
FRONTEND_WEB_HOST_PORT=8082
```

## Testes

```bash
python -m unittest discover -s tests -v
```

Os testes cobrem auth, utilitários HTTP, fluxo de containers, tunnel e websockets com mocks.
Os cenários de API não exigem acesso ao Docker apenas para importar a aplicação. Quando um cenário precisar do engine real, o socket configurado em `DOCKER_SOCKET_PATH` deve estar acessível.

## Produção

```bash
cd ..
cp .env.release.example .env.release
cp backend/.env.example backend/.env
./scripts/deploy-release.sh
```

Healthcheck:

```bash
curl --fail http://localhost:3000/health
```

## Variáveis importantes

- `PORT=3000`
- `JWT_SECRET=...`
- `DOCKER_SOCKET_PATH=/var/run/docker.sock`
- `API_TOKENS=token1,token2`
- `TAILSCALE_CLI_PATH=tailscale`
- `APP_VERSION=0.1.0`
- `APP_COMMIT_SHA=local`
- `LOG_FORMAT=json|text`
- `ENABLE_ACCESS_LOGS=true|false`

## CI/CD

Workflow em `.github/workflows/backend-ci-cd.yml`.

- pull request e push no backend executam testes
- push na `main` publica imagem no GHCR
- push na `main` com secrets de deploy atualiza a stack completa via `scripts/deploy-release.sh`

## Credenciais locais padrão

- usuário: `alice`
- senha: `password123`
