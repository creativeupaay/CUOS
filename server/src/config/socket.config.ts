import { Server as HTTPServer } from 'http';
import { Server, ServerOptions } from 'socket.io';
import { socketAuthMiddleware } from '../modules/collaboration/middleware/socketAuth.middleware';
import { setupNoteHandlers } from '../modules/collaboration/handlers/noteHandler';
import { setupNotificationHandlers } from '../modules/notification/handlers/notificationHandler';
import { setSocketIO } from '../modules/notification/services/notification.service';
import { AuthenticatedSocket } from '../modules/collaboration/types/types';

/**
 * Initialize Socket.io server
 */
export const initializeSocket = (httpServer: HTTPServer): Server => {
  const parseOrigins = (raw?: string): string[] =>
    (raw || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

  const allowedOrigins: string[] = [
    'http://localhost:5173',
    'http://localhost:3000',
    ...parseOrigins(process.env.FRONTEND_URL),
    ...parseOrigins(process.env.FRONTEND_URLS),
  ];

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
    console.log(`[Socket.io] User ${userId} connected (${socket.id})`);

    // Join user's personal room for notifications
    socket.join(`user:${userId}`);

    // Setup note collaboration handlers
    setupNoteHandlers(socket, io);

    // Setup notification handlers
    setupNotificationHandlers(socket, io);

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`[Socket.io] Error for socket ${socket.id}:`, error);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`);
      console.log(`[Socket.io] User ${userId} disconnected (${socket.id})`);
    });
  });

  // Handle server errors
  io.engine.on('connection_error', (error) => {
    console.error('[Socket.io] Connection error:', error);
  });

  console.log('[Socket.io] Server initialized successfully');

  return io;
};

export default initializeSocket;
