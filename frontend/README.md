# Container Manager Frontend

Frontend Expo do projeto `container-manager`.

## Requisitos

- Node.js 20+
- Backend rodando em `http://localhost:3000`

## Setup

### 1. Subir o backend

```bash
cd ../backend
cp .env.example .env
npm install
npm run dev
```

### 2. Subir o frontend

```bash
cd ../frontend
npm install
npm run web
```

Você também pode usar:

```bash
npm run android
npm run ios
```

## Login local

Credenciais seed do backend:

- username: `alice`
- password: `password123`

Se quiser autenticar por token, configure `API_TOKENS` no ambiente do backend.

## Arquitetura atual

- O servidor ativo e a lista de servidores ficam persistidos localmente no frontend
- O backend expõe `auth`, `containers`, `system` e `websocket`
- A aba de terminal ainda não está conectada a uma sessão real interativa

## Scripts

```bash
npm run web
npm run android
npm run ios
npm run lint
```
