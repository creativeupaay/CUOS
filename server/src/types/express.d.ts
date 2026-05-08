/*
  Strict Express response augmentation to enforce a single ApiResponse shape
  Any attempt to call `res.json()` with a different shape will now be a
  TypeScript compile-time error (excess property checks on object literals).
*/

import type { IModulePermissions } from '../modules/auth/models/User.model';

// Define the ApiResponse shape locally so it's available to the declaration
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code?: string;
    details?: unknown;
    stack?: string;
  };
}

// Canonical shape of req.user set by authenticate middleware
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  isPartnerEmployee?: boolean;
  partnerId?: string;
  modulePermissions?: Partial<IModulePermissions>;
  [key: string]: unknown;
}

// Partner context injected by extractPartnerContext middleware
export interface PartnerContext {
  partnerId: string;
  userId: string;
  type: 'partner' | 'employee';
  modulePermissions?: {
    projectManagement?: boolean;
    crm?: boolean;
    teamManagement?: boolean;
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
      user?: AuthenticatedUser;
      partner?: PartnerContext;
    }
  }
}

declare module 'express-serve-static-core' {
  interface Response {
    json(body: ApiResponse): this;
  }
}

export { };
