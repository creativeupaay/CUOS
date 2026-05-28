export default class AppError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;
    code?: string;
    details?: Record<string, unknown> | null;

    constructor(message: string, statusCode: number, code?: string, details?: Record<string, unknown> | null) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        this.code = code;
        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }
}
