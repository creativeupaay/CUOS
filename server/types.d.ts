import mongoose from "mongoose";
import { Role } from "./src/modules/auth/types/auth.types";

/**
 * Standard API Response Structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code?: string;
    details?: any;
    stack?: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
      };
    }

    interface Response {
      /**
       * Send standardized JSON response
       * @override - Overrides Express's default json method to enforce standard response structure
       */
      json(body: ApiResponse): this;
    }
  }
}

export {};
