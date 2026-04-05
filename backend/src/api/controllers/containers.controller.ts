import type { Response } from 'express';
import { dockerService } from '../../services/docker.service';
import { logger } from '../../utils/logger';
import type { AuthRequest } from '../middleware/auth.middleware';
import { z } from 'zod';

const containerIdSchema = z.object({
  id: z.string().min(1),
});

export const listContainers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const all = req.query.all === 'true';
    const containers = await dockerService.listContainers(all);
    res.json({ containers });
  } catch (error) {
    logger.error('Failed to list containers:', error);
    res.status(500).json({ error: 'Failed to list containers' });
  }
};

export const getContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    const container = await dockerService.getContainer(id);
    res.json({ container });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid container ID', details: error.errors });
      return;
    }
    logger.error(`Failed to get container ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get container' });
  }
};

export const startContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    await dockerService.startContainer(id);
    res.json({ message: 'Container started', id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid container ID', details: error.errors });
      return;
    }
    logger.error(`Failed to start container ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to start container' });
  }
};

export const stopContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    await dockerService.stopContainer(id);
    res.json({ message: 'Container stopped', id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid container ID', details: error.errors });
      return;
    }
    logger.error(`Failed to stop container ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to stop container' });
  }
};

export const restartContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    await dockerService.restartContainer(id);
    res.json({ message: 'Container restarted', id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid container ID', details: error.errors });
      return;
    }
    logger.error(`Failed to restart container ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to restart container' });
  }
};

export const pauseContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    await dockerService.pauseContainer(id);
    res.json({ message: 'Container paused', id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid container ID', details: error.errors });
      return;
    }
    logger.error(`Failed to pause container ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to pause container' });
  }
};

export const unpauseContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    await dockerService.unpauseContainer(id);
    res.json({ message: 'Container unpaused', id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid container ID', details: error.errors });
      return;
    }
    logger.error(`Failed to unpause container ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to unpause container' });
  }
};

export const removeContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    const force = req.query.force === 'true';
    await dockerService.removeContainer(id, force);
    res.json({ message: 'Container removed', id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid container ID', details: error.errors });
      return;
    }
    logger.error(`Failed to remove container ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to remove container' });
  }
};

export const getContainerStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    const stats = await dockerService.getContainerStats(id);
    res.json({ stats });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid container ID', details: error.errors });
      return;
    }
    logger.error(`Failed to get stats for container ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get container stats' });
  }
};

export const execInContainer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = containerIdSchema.parse({ id: req.params.id });
    const { cmd, env } = req.body;

    if (!cmd || !Array.isArray(cmd)) {
      res.status(400).json({ error: 'cmd is required and must be an array' });
      return;
    }

    const result = await dockerService.execInContainer(id, cmd, env || {});
    res.json({ ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid container ID', details: error.errors });
      return;
    }
    logger.error(`Failed to exec in container ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to execute command' });
  }
};
