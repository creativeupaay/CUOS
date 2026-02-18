/*
  Strict Express response augmentation to enforce a single ApiResponse shape
  Any attempt to call `res.json()` with a different shape will now be a
  TypeScript compile-time error (excess property checks on object literals).
*/

// Define the ApiResponse shape locally so it's available to the declaration
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

// Augment both the global Express namespace and the express-serve-static-core
// module so different typings usages are covered.

declare global {
  namespace Express {
    interface Response {
      /** Override: Accept only ApiResponse objects */
      json(body: ApiResponse): this;
    }

    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        [key: string]: any;
      };
    }
  }
}

declare module 'express-serve-static-core' {
  interface Response {
    json(body: ApiResponse): this;
  }
}

export { };
