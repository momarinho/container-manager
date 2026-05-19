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

## Setup real

### Backend com Docker

```bash
cd backend
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

API em `http://localhost:3000`.

### Backend local com virtualenv

```bash
cd backend
cp .env.example .env
python -m venv .venv
. .venv/bin/activate
pip install -e .
uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run web
```

Também disponível em `npm run android` e `npm run ios`.

## Funcionalidades já implementadas

- autenticação JWT
- dashboard com métricas do host e containers
- listagem, busca e ações de ciclo de vida dos containers
- criação de container com validação de imagem
- logs em tempo real via WebSocket
- terminal interativo via WebSocket
- configuração de múltiplos servidores no app
- endpoints de túnel Tailscale no backend

## Pendências principais

- interface de túnel no frontend
- gestão dedicada de volumes e redes além da criação
- cobertura de testes mais ampla e pipeline do frontend

## Variáveis importantes

- `PORT`: porta da API, padrão `3000`
- `JWT_SECRET`: segredo JWT com pelo menos 32 caracteres
- `DOCKER_SOCKET_PATH`: socket Docker, padrão `/var/run/docker.sock`
- `API_TOKENS`: tokens opcionais de autenticação
