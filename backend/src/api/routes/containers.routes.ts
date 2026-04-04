import { Router } from 'express';
import {
  listContainers,
  getContainer,
  startContainer,
  stopContainer,
  restartContainer,
  pauseContainer,
  unpauseContainer,
  removeContainer,
  getContainerStats,
  execInContainer,
} from '../controllers/containers.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   GET /api/containers
 * @desc    List all containers
 * @access  Private
 * @query   all - Include stopped containers
 */
router.get('/', authMiddleware, listContainers);

/**
 * @route   GET /api/containers/:id
 * @desc    Get container details
 * @access  Private
 */
router.get('/:id', authMiddleware, getContainer);

/**
 * @route   POST /api/containers/:id/start
 * @desc    Start a container
 * @access  Private
 */
router.post('/:id/start', authMiddleware, startContainer);

/**
 * @route   POST /api/containers/:id/stop
 * @desc    Stop a container
 * @access  Private
 */
router.post('/:id/stop', authMiddleware, stopContainer);

/**
 * @route   POST /api/containers/:id/restart
 * @desc    Restart a container
 * @access  Private
 */
router.post('/:id/restart', authMiddleware, restartContainer);

/**
 * @route   POST /api/containers/:id/pause
 * @desc    Pause a container
 * @access  Private
 */
router.post('/:id/pause', authMiddleware, pauseContainer);

/**
 * @route   POST /api/containers/:id/unpause
 * @desc    Unpause a container
 * @access  Private
 */
router.post('/:id/unpause', authMiddleware, unpauseContainer);

/**
 * @route   DELETE /api/containers/:id
 * @desc    Remove a container
 * @access  Private
 * @query   force - Force removal
 */
router.delete('/:id', authMiddleware, removeContainer);

/**
 * @route   GET /api/containers/:id/stats
 * @desc    Get container stats
 * @access  Private
 */
router.get('/:id/stats', authMiddleware, getContainerStats);

/**
 * @route   POST /api/containers/:id/exec
 * @desc    Execute command in container
 * @access  Private
 * @body    cmd - Array of command strings
 * @body    env - Object with environment variables
 */
router.post('/:id/exec', authMiddleware, execInContainer);

export default router;
