# ContainerMaster Backend

Backend oficial do ContainerMaster em Python, preservando o contrato atual de REST e WebSocket para facilitar a integração com o frontend existente.

## Stack

- FastAPI
- Docker SDK for Python
- psutil
- PyJWT
- bcrypt

## Recursos implementados

- `GET /health`
- `POST /api/auth/login`
- `GET /api/auth/verify`
- `GET|POST /api/auth/validate`
- `GET /api/containers`
- `GET /api/containers/:id`
- `POST /api/containers/:id/start`
- `POST /api/containers/:id/stop`
- `POST /api/containers/:id/restart`
- `POST /api/containers/:id/pause`
- `POST /api/containers/:id/unpause`
- `DELETE /api/containers/:id`
- `GET /api/containers/:id/stats`
- `POST /api/containers/:id/exec`
- `GET /api/system/stats`
- `GET /api/system/stats/history`
- `GET /api/system/info`
- `WS /ws/logs/:containerId`
- `WS /ws/terminal/:containerId`
- `WS /ws/stats`

## Observações de compatibilidade

- O envelope HTTP continua sendo `success/data/error`.
- Os canais WebSocket mantêm os tipos de mensagem consumidos pelo frontend atual.
- O campo `nodeVersion` em `/api/system/info` foi mantido por compatibilidade, mas agora retorna a versão do Python.

## Documentação da API (Swagger)

- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /openapi.json`

Os endpoints estão organizados por tags (`Health`, `Auth`, `Containers`, `System`, `Tunnel`) para facilitar navegação e integração.

## Desenvolvimento

```bash
cp .env.example .env
python -m venv .venv
. .venv/bin/activate
pip install -e .
uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
```

### Testes unitários

```bash
python -m unittest discover -s tests -v
```

## Guia de instalação (produção)

Pré-requisitos:
- Docker Engine + Docker Compose plugin
- Acesso ao socket Docker no host (`/var/run/docker.sock`)
- Arquivo `.env` preenchido (principalmente `JWT_SECRET`)

Passos:
```bash
cp .env.example .env
# ajuste JWT_SECRET e variáveis necessárias
docker compose pull
docker compose up -d
```

Healthcheck:
```bash
curl --fail http://localhost:3000/health
```

## Docker (desenvolvimento)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Scripts de deploy

Deploy padrão (usa `IMAGE_NAME` e `IMAGE_TAG` do ambiente):
```bash
./scripts/deploy.sh
```

Esperar saúde da API:
```bash
./scripts/wait-for-health.sh
```

## CI/CD pipeline

Workflow: `.github/workflows/backend-ci-cd.yml` (na raiz do repositório).

Fluxo:
- Pull Request / Push: executa testes unitários do backend
- Push na `main`: builda imagem Docker e publica no GHCR
- Push na `main` + secrets de deploy: executa deploy remoto por SSH

Secrets opcionais para deploy remoto:
- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH` (opcional, default: `~/container-manager`)
- `DEPLOY_BRANCH` (opcional, default: `main`)

## Credenciais padrão

- Usuário: `alice`
- Senha: `password123`
