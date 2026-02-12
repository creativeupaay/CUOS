import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import AppError from '../utils/appError';

/**
 * Middleware to validate request data using Zod schemas
 * @param schema - Zod schema object with body, query, and/or params schemas
 */
export const validateRequest = (schema: z.Schema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        
        // Format error message
        const message = errorMessages
          .map((err) => `${err.path}: ${err.message}`)
          .join(', ');
        
        return next(new AppError(message, 400));
      }
      next(new AppError('Validation error', 400));
    }
  };
};
