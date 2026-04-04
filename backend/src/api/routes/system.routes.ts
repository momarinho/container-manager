import { Router } from 'express';
import { getStats, getStatsHistory, getSystemInfo } from '../controllers/system.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   GET /api/system/stats
 * @desc    Get current system stats (CPU, Memory, Disk)
 * @access  Private
 */
router.get('/stats', authMiddleware, getStats);

/**
 * @route   GET /api/system/stats/history
 * @desc    Get system stats history
 * @access  Private
 * @query   limit - Number of history entries to return
 */
router.get('/stats/history', authMiddleware, getStatsHistory);

/**
 * @route   GET /api/system/info
 * @desc    Get system information
 * @access  Private
 */
router.get('/info', authMiddleware, getSystemInfo);

export default router;
