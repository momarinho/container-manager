# Container Manager Frontend

Frontend Expo do projeto `container-manager`, compartilhando contrato com o backend FastAPI.

## Requisitos

- Node.js 20+
- backend disponível em `http://localhost:3000`

## Setup

### 0. Subir a stack completa com Docker

```bash
cd ..
cp .env.example .env
cp backend/.env.example backend/.env
./scripts/docker-up.sh
```

Isso sobe:

- backend em `http://localhost:3000`
- frontend web em `http://localhost:8081`

O fluxo Docker cobre apenas a experiência web. Android e iOS continuam via Expo local.
Nesse modo, o frontend web é servido como build estática. Mudanças no código do frontend exigem rebuild da imagem.

Se essas portas já estiverem ocupadas, o script procura a proxima porta livre automaticamente.

Para fixar portas manualmente no `.env` da raiz:

```bash
BACKEND_HOST_PORT=3001
FRONTEND_WEB_HOST_PORT=8082
```

### 1. Subir o backend

Opção Docker:

```bash
cd ../backend
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Opção local:

```bash
cd ../backend
cp .env.example .env
python -m venv .venv
. .venv/bin/activate
pip install -e .
uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
```

### 2. Subir o frontend

```bash
cd ../frontend
npm install
npm run web
```

Também disponível em:

```bash
npm run android
npm run ios
```

## Login local

- username: `alice`
- password: `password123`

Se quiser autenticar por token, configure `API_TOKENS` no backend.

## Arquitetura atual

- o servidor ativo e a lista de servidores ficam persistidos localmente
- o app consome `auth`, `containers`, `system`, `tunnel` e `websocket`
- logs e terminal usam sessões reais via WebSocket
- a UI de túnel já consome REST e WebSocket do backend

## Scripts

```bash
npm run web
npm run android
npm run ios
npm run lint
npm run typecheck
npm run verify
```
