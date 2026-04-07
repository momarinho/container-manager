# Container Manager 🐳

Uma solução completa para monitoramento e gerenciamento de containers Docker, oferecendo uma interface intuitiva (Mobile e Web) e uma API robusta para controle em tempo real.

## 🚀 Tecnologias

Este projeto utiliza uma arquitetura moderna dividida em:

- **Backend:** Python 3.11+, FastAPI, Uvicorn, Docker SDK, JWT e Bcrypt.
- **Frontend:** React Native com Expo, Expo Router, Lucide Icons e Axios.
- **Shared:** Módulos compartilhados entre os ambientes.

## 📦 Estrutura do Projeto

```text
.
├── backend/       # API de gerenciamento (FastAPI)
├── frontend/      # App Mobile & Web (React Native/Expo)
├── shared/        # Lógica e tipos compartilhados
└── docker-compose.yml # Orquestração para desenvolvimento
```

## 🛠️ Como Executar

### Pré-requisitos
- Docker e Docker Compose instalados.
- Node.js & npm/yarn (para rodar o frontend localmente).
- Python 3.11+ (se preferir rodar o backend fora do Docker).

### 1. Backend (API)
Navegue até a pasta backend e configure o ambiente:
```bash
cd backend
cp .env.example .env
# Inicie com Docker
docker-compose up --build
```
A API estará disponível em `http://localhost:8000`.

### 2. Frontend (App)
Instale as dependências e inicie o Expo:
```bash
cd frontend
npm install
# Para Web
npm run web
# Para Mobile (Android/iOS)
npm run android # ou npm run ios
```

## ✨ Funcionalidades (Roadmap)
- [x] Listagem de containers ativos.
- [x] Monitoramento de recursos (CPU, Memória via psutil).
- [x] Autenticação segura com JWT.
- [x] Suporte a WebSockets para atualizações em tempo real.
- [ ] Gerenciamento de Volumes e Redes.
- [ ] Logs dos containers em tempo real.

## 🔑 Variáveis de Ambiente
O backend requer algumas configurações básicas no `.env`:
- `DOCKER_HOST`: URL do socket do Docker (padrão: `unix:///var/run/docker.sock`).
- `SECRET_KEY`: Chave para geração de tokens JWT.

---
Desenvolvido por [momarinho](https://github.com/momarinho)
