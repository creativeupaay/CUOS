import { StatusCodes } from 'http-status-codes';
import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/appError';
import { env } from '../config/env.config';
import { ApiResponse } from '../types/express.d';
import { logger } from "../utils/logger";

// Mongoose-specific error shapes (not exported by mongoose, so we define minimal interfaces)
interface MongooseValidationError extends Error {
    name: 'ValidationError';
    errors: Record<string, { message: string }>;
}

interface MongoDuplicateKeyError extends Error {
    code: 11000;
    keyValue: Record<string, unknown>;
}

interface MongooseCastError extends Error {
    name: 'CastError';
    path: string;
    value: unknown;
}

type KnownError =
    | Error
    | MongooseValidationError
    | MongoDuplicateKeyError
    | MongooseCastError
    | AppError;

const errorHandlerMiddleware = (
    err: KnownError,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction
) => {
    logger.info("---errorHandlerMiddleware---");
    logger.info(err);
    let error: AppError;

    // Guard against null/non-object errors
    if (err == null) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'An unexpected error occurred',
        });
    }

    if (err instanceof AppError) {
        error = err;
    } else {
        error = new AppError(
            err.message || 'Something went wrong, try again later',
            (err as AppError).statusCode || StatusCodes.INTERNAL_SERVER_ERROR
        );
    }

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        const validationErr = err as MongooseValidationError;
        const message = Object.values(validationErr.errors)
            .map((item) => item.message)
            .join(', ');
        error = new AppError(message, StatusCodes.BAD_REQUEST, 'VALIDATION_ERROR', validationErr.errors);
    }

    // Handle Mongoose duplicate key errors
    if ((err as MongoDuplicateKeyError).code === 11000) {
        const dupeErr = err as MongoDuplicateKeyError;
        const field = Object.keys(dupeErr.keyValue)[0];
        error = new AppError(
            `${field} already exists`,
            StatusCodes.BAD_REQUEST,
            'DUPLICATE_KEY',
            { field, value: dupeErr.keyValue[field] }
        );
    }

    // Handle Mongoose CastError
    if (err.name === 'CastError') {
        const castErr = err as MongooseCastError;
        error = new AppError(
            `Invalid ${castErr.path}: ${castErr.value}`,
            StatusCodes.BAD_REQUEST,
            'CAST_ERROR',
            { path: castErr.path, value: castErr.value }
        );
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = new AppError('Invalid token', StatusCodes.UNAUTHORIZED, 'INVALID_TOKEN');
    }

    if (err.name === 'TokenExpiredError') {
        error = new AppError('Token expired', StatusCodes.UNAUTHORIZED, 'TOKEN_EXPIRED');
    }

    // Build standardized error response
    const response: ApiResponse = {
        success: false,
        message: error.message,
    };

    // Add error details if available
    const errorDetails: ApiResponse['error'] = {};

    if (error.code) {
        errorDetails.code = error.code;
    }

    if (error.details) {
        errorDetails.details = error.details;
    }

    // Include stack trace in development mode
    if (env.NODE_ENV === 'development') {
        errorDetails.stack = error.stack;
    }

    if (Object.keys(errorDetails).length > 0) {
        response.error = errorDetails;
    }

    res.status(error.statusCode).json(response);
};

export default errorHandlerMiddleware;
