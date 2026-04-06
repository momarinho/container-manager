import type { Response } from "express";
import { systemStatsService } from "../../services/systemStats.service";
import { fail, ok } from "../../utils/http";
import { logger } from "../../utils/logger";
import type { AuthRequest } from "../middleware/auth.middleware";

export const getStats = async (
  _req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const stats = systemStatsService.getCurrentStats();
    ok(res, stats);
  } catch (error) {
    logger.error("Failed to get system stats:", error);
    fail(res, 500, "SYSTEM_STATS_FAILED", "Failed to get system stats");
  }
};

export const getStatsHistory = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : undefined;
    const history = systemStatsService.getHistory(limit);
    ok(res, history);
  } catch (error) {
    logger.error("Failed to get stats history:", error);
    fail(res, 500, "SYSTEM_STATS_HISTORY_FAILED", "Failed to get stats history");
  }
};

export const getSystemInfo = async (
  _req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const info = await systemStatsService.getSystemInfo();
    ok(res, info);
  } catch (error) {
    logger.error("Failed to get system info:", error);
    fail(res, 500, "SYSTEM_INFO_FAILED", "Failed to get system info");
  }
};
