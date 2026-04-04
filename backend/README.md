# ContainerMaster Backend

Backend agent for ContainerMaster - Docker container management with WebSocket support.

## Features

- REST API for container lifecycle management
- WebSocket for real-time logs and terminal sessions
- System stats (CPU, Memory, Disk) monitoring
- JWT-based authentication
- Rate limiting and security headers

## Prerequisites

- Node.js 20+
- Docker Engine
- Docker socket access

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Docker Deployment

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop
docker-compose down
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get JWT token

### Containers
- `GET /api/containers` - List all containers
- `GET /api/containers/:id` - Get container details
- `POST /api/containers/:id/start` - Start container
- `POST /api/containers/:id/stop` - Stop container
- `POST /api/containers/:id/restart` - Restart container
- `POST /api/containers/:id/pause` - Pause container
- `POST /api/containers/:id/unpause` - Unpause container

### System
- `GET /api/system/stats` - Get system stats (CPU, Memory, Disk)
- `GET /api/system/info` - Get system information

### WebSocket
- `WS /ws/logs/:containerId` - Real-time log streaming
- `WS /ws/terminal/:containerId` - Interactive terminal session
- `WS /ws/stats` - Real-time system stats broadcast

## Security

- JWT authentication required for all endpoints (except `/health`)
- Rate limiting (100 requests per minute by default)
- CORS configuration
- Helmet security headers

## License

MIT
