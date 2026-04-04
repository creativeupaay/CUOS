import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { verifyAccessToken } from '../../auth/utils/jwt.util';
import { AuthenticatedSocket } from '../types/types';
import { User } from '../../auth/models/User.model';

const getCookieValue = (cookieHeader: string | undefined, name: string): string | null => {
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === name) {
      const value = rawValue.join('=');
      return value ? decodeURIComponent(value) : null;
    }
  }

  return null;
};

/**
 * Socket.io authentication middleware
 * Validates JWT token and attaches user data to socket
 */
export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: ExtendedError) => void
) => {
  try {
    // Extract token from handshake auth first, then fallback to accessToken cookie.
    const authToken = socket.handshake.auth?.token;
    const cookieToken = getCookieValue(socket.handshake.headers.cookie, 'accessToken');
    const token = authToken || cookieToken;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    // Verify JWT token
    const payload = verifyAccessToken(token);

    // Check if user exists and is active
    const user = await User.findById(payload.userId)
      .select('_id email isActive')
      .lean();

    if (user) {
      if (!user.isActive) {
        return next(new Error('User account is inactive'));
      }
      
      // Attach user data to socket
      (socket as AuthenticatedSocket).data = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      };
      
      return next();
    }

    // Fallback to PartnerEmployee
    const { PartnerEmployee } = await import('../../partners/models/PartnerEmployee.model');
    const partnerEmployee = await PartnerEmployee.findById(payload.userId)
      .select('_id email isActive')
      .lean();

    if (!partnerEmployee) {
      return next(new Error('User not found'));
    }

    if (!partnerEmployee.isActive) {
      return next(new Error('User account is inactive'));
    }

    // Attach user data to socket for partner employee
    (socket as AuthenticatedSocket).data = {
      userId: payload.userId,
      email: partnerEmployee.email, // using partnerEmployee email explicitly
      role: 'partner',
    };

    next();
  } catch (error: any) {
    console.error('Socket authentication error:', error.message);
    next(new Error('Authentication failed'));
  }
};
