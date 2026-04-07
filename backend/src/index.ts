import express from "express";
import { createServer } from "http";
import helmet from "helmet";
import cors from "cors";
import { config, isDevelopment } from "./utils/config";
import { ok } from "./utils/http";
import { logger } from "./utils/logger";
import { WebSocketHandler } from "./websocket/handler";
import { rateLimitMiddleware } from "./api/middleware/rateLimit.middleware";
import {
  errorHandler,
  notFoundHandler,
} from "./api/middleware/errorHandler.middleware";
import authRoutes from "./api/routes/auth.routes";
import containersRoutes from "./api/routes/containers.routes";
import systemRoutes from "./api/routes/system.routes";

const app = express();
const server = createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({ origin: config.cors.origin }));
app.use(rateLimitMiddleware);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check (no auth required)
app.get("/health", (_req, res) => {
  ok(res, {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: (process as any).uptime(),
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/containers", containersRoutes);
app.use("/api/system", systemRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

const publicHost = config.host === "0.0.0.0" ? "localhost" : config.host;

// Start server
server.listen(config.port, config.host, () => {
  // Initialize WebSocket handler after server is listening
  void new WebSocketHandler(server);
  logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              ContainerMaster Backend Agent                   ║
║                                                               ║
║  Host:         ${config.host.padEnd(20)}║
║  Environment:  ${config.nodeEnv.padEnd(20)}║
║  Port:         ${config.port.toString().padEnd(20)}║
║  API:          http://${publicHost}:${config.port}/api       ║
║  WebSocket:    ws://${publicHost}:${config.port}/ws          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  if (isDevelopment) {
    logger.info(`
Development mode:
  - HOST: ${config.host}
  - JWT_SECRET: ${config.jwt.secret}
  - CORS_ORIGIN: ${config.cors.origin}
    `);
  }
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

export default app;
