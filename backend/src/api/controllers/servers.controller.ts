import type { Response } from 'express';
import { serversService } from '../../services/servers.service';
import { logger } from '../../utils/logger';
import type { AuthRequest } from '../middleware/auth.middleware';
import type { CreateServerRequest } from '../../types/server.types';
import { z } from 'zod';

const createServerSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
});

const serverIdSchema = z.object({
  id: z.string().uuid(),
});

export const listServers = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const servers = await serversService.list();
    res.json({ servers });
  } catch (error) {
    logger.error('Failed to list servers:', error);
    res.status(500).json({ error: 'Failed to list servers' });
  }
};

export const createServer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const input = createServerSchema.parse(req.body) as CreateServerRequest;
    const result = await serversService.create(input);

    if (!result.connection.success) {
      res.status(400).json({
        error: 'Failed to connect to server',
        message: result.connection.message,
      });
      return;
    }

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
      return;
    }
    logger.error('Failed to create server:', error);
    res.status(500).json({ error: 'Failed to create server' });
  }
};

export const deleteServer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = serverIdSchema.parse({ id: req.params.id });
    const deleted = await serversService.remove(id);

    if (!deleted) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    res.json({ message: 'Server deleted', id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid server ID', details: error.errors });
      return;
    }
    logger.error(`Failed to delete server ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete server' });
  }
};
