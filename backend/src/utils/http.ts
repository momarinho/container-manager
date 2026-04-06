import type { Response } from 'express';

export function ok<T, M = Record<string, never>>(res: Response, data: T, meta?: M): Response {
  return res.json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
}
