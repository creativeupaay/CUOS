import { Server as HTTPServer } from 'http';
import { Server, ServerOptions } from 'socket.io';
import { socketAuthMiddleware } from '../modules/collaboration/middleware/socketAuth.middleware';
import { setupNoteHandlers } from '../modules/collaboration/handlers/noteHandler';
import { setupNotificationHandlers } from '../modules/notification/handlers/notificationHandler';
import { setupGameHandlers } from '../modules/game-zone/realtime/gameSocketHandlers';
import { resumePendingTimers } from '../modules/game-zone/services/gameStateMachine.service';
import { setupWordleHandlers } from '../modules/game-zone/realtime/wordleSocketHandlers';
import { resumeWordleTimers } from '../modules/game-zone/services/wordle/wordleStateMachine.service';
import { setSocketIO } from '../modules/notification/services/notification.service';
import { AuthenticatedSocket } from '../modules/collaboration/types/types';
import { logger } from '../utils/logger';
import { env } from './env.config';

/**
 * Initialize Socket.io server
 */
export const initializeSocket = (httpServer: HTTPServer): Server => {
  const allowedOrigins: string[] = Array.from(new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5175',
    'http://localhost:3000',
    env.FRONTEND_URL,
    ...env.FRONTEND_URLS,
  ]));

  const isAllowedOrigin = (origin?: string): boolean => {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;

    // Allow all subdomains of creativeupaay.in for deployed environments.
    return /^https?:\/\/([a-z0-9-]+\.)*creativeupaay\.in$/i.test(origin);
  };

  // Socket.io configuration
  const socketOptions: Partial<ServerOptions> = {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Socket CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    transports: ['websocket', 'polling'], // WebSocket preferred, polling fallback
  };

  // Create Socket.io server
  const io = new Server(httpServer, socketOptions);

  // Set socket.io instance for notification service
  setSocketIO(io);

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  // Handle connections
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.data.userId;
    logger.info(`[Socket.io] User ${userId} connected (${socket.id})`);

    // Join user's personal room for notifications
    socket.join(`user:${userId}`);

    // Setup note collaboration handlers
    setupNoteHandlers(socket, io);

    // Setup notification handlers
    setupNotificationHandlers(socket, io);

    // Setup game zone handlers (Imposter)
    setupGameHandlers(socket, io);

    // Setup Wordle game handlers (isolated from Imposter)
    setupWordleHandlers(socket, io);

    // Handle connection errors
    socket.on('error', (error) => {
      logger.error({ context: error }, `[Socket.io] Error for socket ${socket.id}:`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`);
      logger.info(`[Socket.io] User ${userId} disconnected (${socket.id})`);
    });
  });

  // Handle server errors
  io.engine.on('connection_error', (error) => {
    logger.error({ context: error }, '[Socket.io] Connection error:');
  });

  logger.info('[Socket.io] Server initialized successfully');

  // Resume any pending timers from sessions that were active before restart
  resumePendingTimers(io).catch((err) => {
    logger.error({ err }, '[Socket.io] Failed to resume pending game timers');
  });

  // Resume pending Wordle round timers
  resumeWordleTimers(io).catch((err) => {
    logger.error({ err }, '[Socket.io] Failed to resume pending Wordle timers');
  });

  return io;
};

export default initializeSocket;
