import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { ZodError } from 'zod';
import { fail } from '../../utils/http';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Error:', err);

  if (err instanceof ZodError) {
    fail(res, 400, 'VALIDATION_ERROR', 'Validation error', err.errors);
    return;
  }

  if (err instanceof AppError) {
    fail(res, err.statusCode, 'APP_ERROR', err.message);
    return;
  }

  fail(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    'Internal server error',
    process.env.NODE_ENV === 'development' ? { message: err.message } : undefined
  );
};

export const notFoundHandler = (req: Request, res: Response): void => {
  fail(res, 404, 'NOT_FOUND', 'Not found', { path: req.path });
};
