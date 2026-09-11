# Roadmap de Integração e Aprendizado em Go (Golang)

> **Projeto:** ContainerMaster (Container Manager)  
> **Objetivo:** Aplicar Go de forma progressiva e modular no ecossistema de gerenciamento de containers, maximizando o aprendizado prático sem quebrar o backend (Python) ou frontend (React Native) existentes.

---

## 1. Por que Go faz sentido neste projeto?

O ecossistema moderno de containers (**Docker**, **Moby**, **containerd**, **Kubernetes**, **Podman**) foi quase inteiramente construído em Go. 

Embora o backend em Python (FastAPI) atenda muito bem a lógica de negócio e o frontend em React Native entregue uma ótima interface mobile, o Go traz vantagens estratégicas únicas para sistemas e infraestrutura:
* **SDK Nativo e Oficial:** O Docker Engine SDK é mantido prioritariamente em Go (`github.com/docker/docker/client`).
* **Binários Únicos Estáticos:** Não precisa de interpretador ou runtime; compila para um único executável portátil (de 10 a 20 MB).
* **Concorrência Nativa de Baixo Custo:** Goroutines e Channels permitem processar centenas de streams de logs e conexões WebSocket consumindo poucos megabytes de memória.
* **Ecossistema de Ferramentas de Terminal:** As melhores bibliotecas de CLI (`cobra`) e TUI (`bubbletea`) do mercado são de Go.

---

## 2. Estratégia de Adoção: Componentes Desacoplados

Em vez de uma reescrita total (que seria custosa e arriscada), a melhor estratégia de aprendizado e engenharia é **adicionar ferramentas satélites em Go** que complementam o ecossistema existente:

```mermaid
graph TD
    subgraph "Clientes"
        Mobile["Frontend Mobile (React Native)"]
        CLI["Novo: CLI / TUI em Go (cmctl)"]
    end

    subgraph "Serviços"
        BackendPy["Backend API (Python / FastAPI)"]
        AgentGo["Novo: Agente de Métricas (Go Daemon)"]
        ProxyGo["Opcional: Socket Proxy Seguro (Go)"]
    end

    subgraph "Infraestrutura"
        DockerSocket["/var/run/docker.sock"]
        Containers["Containers Docker"]
    end

    Mobile -->|REST / WebSocket| BackendPy
    CLI -->|REST / WebSocket| BackendPy
    CLI -->|Direto (Dev/Admin)| DockerSocket

    BackendPy --> DockerSocket
    AgentGo --> DockerSocket
    AgentGo -->|Push Métricas / WS| BackendPy
```

---

## 3. Fases do Roadmap

### Fase 1: CLI nativo do ContainerMaster (`cmctl`) — *Primeiro Passo Recomendado*
Desenvolver uma ferramenta de linha de comando oficial para o ContainerMaster usando Go.

* **O que faz:**
  * Permite listar containers, ver status, dar start/stop e visualizar logs direto pelo terminal.
  * Pode autenticar contra a API FastAPI do backend (`/api/auth/login`) ou se comunicar diretamente com o Docker em modo local.
* **Conceitos de Go aplicados:**
  * Estrutura de pacotes e `go.mod`.
  * Criação de CLI profissional com [spf13/cobra](https://github.com/spf13/cobra) (o mesmo usado pelo Docker e `kubectl`).
  * Requisições HTTP com a biblioteca padrão (`net/http`), parsing de JSON em `structs`.
  * Tratamento idiomático de erros (`if err != nil`).
* **Evolução visual (Opcional):**
  * Criar uma interface gráfica interativa de terminal (TUI) com [Charm Bubble Tea](https://github.com/charmbracelet/bubbletea) (estilo `lazydocker` / `k9s`).

---

### Fase 2: Agente Leve de Métricas e Streaming de Logs
Criar um micro-daemon em Go focado exclusivamente em coletar métricas de alta frequência de CPU, memória e streaming de logs dos containers.

* **O que faz:**
  * Escuta o Docker socket usando o SDK oficial do Docker em Go.
  * Coleta estatísticas de CPU, memória, I/O e rede.
  * Transmite esses dados em tempo real via WebSocket para o backend FastAPI ou direto para clientes conectados.
* **Conceitos de Go aplicados:**
  * Uso do SDK oficial: `github.com/docker/docker/client`.
  * **Concorrência com Goroutines:** Uma goroutine por container monitorado.
  * **Channels e Select:** Multiplexação de mensagens e comunicação segura entre threads leves.
  * `context.Context` para cancelamento gracioso de streams e timeouts.
  * Uso mínimo de recursos (consumo de ~10 MB de RAM).

---

### Fase 3: Docker Socket Proxy Seguro Customizado
Criar um micro-proxy em Go que se posiciona entre serviços não confiáveis e o socket do Docker (`/var/run/docker.sock`).

* **O que faz:**
  * Intercepta requisições HTTP enviadas para o Unix Domain Socket do Docker.
  * Valida e filtra requisições:
    * Bloqueia chamadas proibidas (ex.: `POST /containers/create` com privilégios de `root` ou volumes montados em `/`).
    * Permite apenas leitura (`GET`) para rotas públicas.
* **Conceitos de Go aplicados:**
  * Redes em baixo nível: Unix Domain Sockets (`net.Dial("unix", ...)`).
  * `net/http/httputil.ReverseProxy` para reescrita e inspeção de tráfego HTTP.
  * Empacotamento em imagem Docker minimalista baseada em `scratch` (< 10 MB total).

---

### Fase 4 (Avançado): Migração seletiva de rotas críticas
Se houver gargalo no backend Python devido ao GIL (*Global Interpreter Lock*) em rotas de streaming pesado:
* Migrar a camada de WebSocket de logs e terminal PTY para um serviço Go de altíssimo throughput.

---

## 4. Estrutura Atual no Repositório

```text
container-manager/
├── backend/            # Python / FastAPI (Regras de negócio, banco, auth)
├── frontend/           # React Native / Expo (Interface mobile e web)
├── cli/                # Concluído: cmctl CLI (Cobra, Docker SDK, logs, tests)
│   ├── cmd/            # root, version, status, ps, start, stop, logs
│   ├── go.mod
│   └── main.go
├── agent/              # Concluído: Metrics Agent HTTP & SSE Server
│   ├── Dockerfile      # Multi-stage build ultra-leve (< 15 MB)
│   ├── go.mod
│   └── main.go         # Hub pub/sub, Goroutines paralelas, /metrics e /metrics/stream
├── proxy/              # Concluído: Docker Socket Security Proxy
│   ├── Dockerfile      # Multi-stage build ultra-leve (< 10 MB)
│   ├── go.mod
│   ├── main.go         # Reverse proxy para unix socket, policy engine e filtering
│   └── main_test.go    # Testes unitários do motor de segurança
├── docker-compose.yml  # Inclui metrics-agent (9090) e o proxy nativo em Go (2375)
├── docs/
│   └── golang-roadmap.md
└── .gitignore
```

---

## 5. Status do Roadmap

1. [x] **Fase 1: CLI Nativo (`cmctl`)** — Concluído (version, status, ps, start, stop, logs, testes unitários).
2. [x] **Fase 2: Agente Leve de Métricas** — Concluído (Goroutines, Channels, Broadcaster SSE/HTTP, Dockerfile e Compose).
3. [x] **Fase 3: Docker Socket Proxy Seguro em Go** — Concluído (Reverse proxy para Unix socket, inspeção de segurança, testes e Compose).
4. [ ] **Fase 4: Otimizações de Alta Concorrência** — Opcional / Futuro.

