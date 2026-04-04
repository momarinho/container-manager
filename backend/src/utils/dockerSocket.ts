import fs from 'fs';
import path from 'path';
import { config } from './config';
import { logger } from './logger';

export function getDockerSocketPath(): string {
  const socketPath = config.docker.socketPath;

  if (fs.existsSync(socketPath)) {
    return socketPath;
  }

  const alternatives = [
    '/var/run/docker.sock',
    '/var/run/docker-cli.sock',
    path.join(process.env.HOME || '', '.docker/run/docker.sock'),
  ];

  for (const alt of alternatives) {
    if (fs.existsSync(alt)) {
      logger.warn(`Docker socket not found at ${socketPath}, using ${alt}`);
      return alt;
    }
  }

  throw new Error(
    `Docker socket not found. Checked: ${socketPath}, ${alternatives.join(', ')}`
  );
}
