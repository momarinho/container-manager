import type { Response } from 'express';
import { systemStatsService } from '../../services/systemStats.service';
import { logger } from '../../utils/logger';
import type { AuthRequest } from '../middleware/auth.middleware';

export const getStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = systemStatsService.getCurrentStats();
    res.json({ stats });
  } catch (error) {
    logger.error('Failed to get system stats:', error);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
};

export const getStatsHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const history = systemStatsService.getHistory(limit);
    res.json({ history });
  } catch (error) {
    logger.error('Failed to get stats history:', error);
    res.status(500).json({ error: 'Failed to get stats history' });
  }
};

export const getSystemInfo = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const info = await systemStatsService.getSystemInfo();
    res.json({ info });
  } catch (error) {
    logger.error('Failed to get system info:', error);
    res.status(500).json({ error: 'Failed to get system info' });
  }
};
