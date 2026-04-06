import type { Response } from 'express';
import { dockerService } from '../../services/docker.service';
import { logger } from '../../utils/logger';
import { fail, ok } from '../../utils/http';
import type { AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const containerIdSchema = z.object({
  id: z.string().min(1),
});

export const listContainers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const all = req.query.all === 'true';
    const { status, name } = req.query;
    
    let containers = await dockerService.listContainers(all);
    
    // Filtro por status
    if (status && typeof status === 'string') {
      containers = containers.filter((c) => c.state === status);
    }
    
    // Filtro por nome (busca parcial, case-insensitive)
    if (name && typeof name === 'string') {
      const searchTerm = name.toLowerCase();
      containers = containers.filter((c) =>
        c.names.some((n) => n.toLowerCase().includes(searchTerm)) ||
        c.image.toLowerCase().includes(searchTerm)
      );
    }
    
    ok(res, containers, { count: containers.length });
  } catch (error) {
    logger.error('Failed to list containers:', error);
    fail(res, 500, 'CONTAINERS_LIST_FAILED', 'Failed to list containers');
  }
};

export const getContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    const container = await dockerService.getContainer(id);
    ok(res, container);
  } catch (error) {
    if (error instanceof z.ZodError) {
      fail(res, 400, 'INVALID_CONTAINER_ID', 'Invalid container ID', error.errors);
      return;
    }
    logger.error(`Failed to get container ${req.params.id}:`, error);
    fail(res, 500, 'CONTAINER_GET_FAILED', 'Failed to get container');
  }
};

export const startContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    await dockerService.startContainer(id);
    ok(res, { id, message: 'Container started' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      fail(res, 400, 'INVALID_CONTAINER_ID', 'Invalid container ID', error.errors);
      return;
    }
    logger.error(`Failed to start container ${req.params.id}:`, error);
    fail(res, 500, 'CONTAINER_START_FAILED', 'Failed to start container');
  }
};

export const stopContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    await dockerService.stopContainer(id);
    ok(res, { id, message: 'Container stopped' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      fail(res, 400, 'INVALID_CONTAINER_ID', 'Invalid container ID', error.errors);
      return;
    }
    logger.error(`Failed to stop container ${req.params.id}:`, error);
    fail(res, 500, 'CONTAINER_STOP_FAILED', 'Failed to stop container');
  }
};

export const restartContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    await dockerService.restartContainer(id);
    ok(res, { id, message: 'Container restarted' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      fail(res, 400, 'INVALID_CONTAINER_ID', 'Invalid container ID', error.errors);
      return;
    }
    logger.error(`Failed to restart container ${req.params.id}:`, error);
    fail(res, 500, 'CONTAINER_RESTART_FAILED', 'Failed to restart container');
  }
};

export const pauseContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    await dockerService.pauseContainer(id);
    ok(res, { id, message: 'Container paused' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      fail(res, 400, 'INVALID_CONTAINER_ID', 'Invalid container ID', error.errors);
      return;
    }
    logger.error(`Failed to pause container ${req.params.id}:`, error);
    fail(res, 500, 'CONTAINER_PAUSE_FAILED', 'Failed to pause container');
  }
};

export const unpauseContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    await dockerService.unpauseContainer(id);
    ok(res, { id, message: 'Container unpaused' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      fail(res, 400, 'INVALID_CONTAINER_ID', 'Invalid container ID', error.errors);
      return;
    }
    logger.error(`Failed to unpause container ${req.params.id}:`, error);
    fail(res, 500, 'CONTAINER_UNPAUSE_FAILED', 'Failed to unpause container');
  }
};

export const removeContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    const force = req.query.force === 'true';
    await dockerService.removeContainer(id, force);
    ok(res, { id, message: 'Container removed' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      fail(res, 400, 'INVALID_CONTAINER_ID', 'Invalid container ID', error.errors);
      return;
    }
    logger.error(`Failed to remove container ${req.params.id}:`, error);
    fail(res, 500, 'CONTAINER_REMOVE_FAILED', 'Failed to remove container');
  }
};

export const getContainerStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    const stats = await dockerService.getContainerStats(id);
    ok(res, stats);
  } catch (error) {
    if (error instanceof z.ZodError) {
      fail(res, 400, 'INVALID_CONTAINER_ID', 'Invalid container ID', error.errors);
      return;
    }
    logger.error(`Failed to get stats for container ${req.params.id}:`, error);
    fail(res, 500, 'CONTAINER_STATS_FAILED', 'Failed to get container stats');
  }
};

export const execInContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    const { cmd, env } = req.body;

    if (!cmd || !Array.isArray(cmd)) {
      fail(res, 400, 'INVALID_EXEC_COMMAND', 'cmd is required and must be an array');
      return;
    }

    const result = await dockerService.execInContainer(id, cmd, env || {});
    ok(res, result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      fail(res, 400, 'INVALID_CONTAINER_ID', 'Invalid container ID', error.errors);
      return;
    }
    logger.error(`Failed to exec in container ${req.params.id}:`, error);
    fail(res, 500, 'CONTAINER_EXEC_FAILED', 'Failed to execute command');
  }
};
