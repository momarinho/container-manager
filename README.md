# Container Manager

Aplicação para monitorar e operar containers Docker com backend FastAPI e frontend Expo/React Native.

## Stack

- `backend/`: Python 3.11+, FastAPI, Docker SDK, psutil, JWT
- `frontend/`: Expo Router, React Native, TypeScript
- `shared/`: tipos compartilhados

## Estrutura

```text
.
├── backend/   # API e integração com Docker/Tailscale
├── frontend/  # App web/mobile
└── shared/    # Tipos compartilhados
```

## Setup

### Stack completa com Docker

```bash
cp .env.example .env
cp backend/.env.example backend/.env
./scripts/docker-up.sh
```

Serviços expostos:

- frontend web em `http://localhost:8081`
- backend em `http://localhost:3000`

Esse fluxo cobre backend + frontend web. Mobile continua fora do Docker com `npm run android` e `npm run ios`.
Na stack da raiz, o backend sobe com reload e o frontend web é servido como build estática.
Se você alterar código do frontend, rode o script novamente para rebuildar a imagem web.

Se `3000` ou `8081` estiverem ocupadas, o script procura a proxima porta livre automaticamente.

Para subir em background:

```bash
./scripts/docker-up.sh -d
```

Se quiser fixar portas manualmente, ajuste no `.env` da raiz:

```bash
cp .env.example .env
BACKEND_HOST_PORT=3001
FRONTEND_WEB_HOST_PORT=8082
./scripts/docker-up.sh
```

### Backend com Docker

```bash
cd backend
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### Backend local com virtualenv

```bash
cd backend
cp .env.example .env
python -m venv .venv
. .venv/bin/activate
pip install -e .
uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
```

### Frontend local

```bash
cd frontend
npm install
npm run web
```

Também disponível em `npm run android` e `npm run ios`.

## Funcionalidades implementadas

- autenticação JWT
- dashboard com métricas do host e containers
- listagem, busca e ações de ciclo de vida dos containers
- criação de container com validação de imagem
- logs em tempo real via WebSocket
- terminal interativo via WebSocket
- configuração de múltiplos servidores no app
- monitoramento e controle de tunnel Tailscale no frontend

## Fluxos principais

- login e troca de servidor com persistência local
- create, start, stop, restart, pause e unpause de containers
- inspeção de detalhes, portas, mounts e métricas
- streaming de logs e terminal remoto por container
- status, conexão e desconexão do tunnel

## Qualidade

Frontend:

```bash
cd frontend
npm run lint
npx tsc --noEmit
```

Backend:

```bash
cd backend
./.venv/bin/python -m unittest discover -s tests -v
```

## Pendências principais

- gestão dedicada de volumes e redes além da criação
- smoke tests ponta a ponta do fluxo completo
- pipeline dedicada para o frontend

## Variáveis importantes

- `PORT`: porta da API, padrão `3000`
- `JWT_SECRET`: segredo JWT com pelo menos 32 caracteres
- `DOCKER_SOCKET_PATH`: socket Docker, padrão `/var/run/docker.sock`
- `API_TOKENS`: tokens opcionais de autenticação
