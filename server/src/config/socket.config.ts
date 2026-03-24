import { Server as HTTPServer } from 'http';
import { Server, ServerOptions } from 'socket.io';
import { socketAuthMiddleware } from '../modules/collaboration/middleware/socketAuth.middleware';
import { setupNoteHandlers } from '../modules/collaboration/handlers/noteHandler';
import { AuthenticatedSocket } from '../modules/collaboration/types/types';

/**
 * Initialize Socket.io server
 */
export const initializeSocket = (httpServer: HTTPServer): Server => {
  // Socket.io configuration
  const socketOptions: Partial<ServerOptions> = {
    cors: {
      origin: [
        'http://localhost:5173', // Local development
        'http://localhost:3000',
        process.env.FRONTEND_URL || '',
      ].filter(Boolean),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000, // 60 seconds
    pingInterval: 25000, // 25 seconds
    transports: ['websocket', 'polling'], // WebSocket preferred, polling fallback
  };

  // Create Socket.io server
  const io = new Server(httpServer, socketOptions);

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  // Handle connections
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[Socket.io] User ${socket.data.userId} connected (${socket.id})`);

    // Setup note collaboration handlers
    setupNoteHandlers(socket, io);

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`[Socket.io] Error for socket ${socket.id}:`, error);
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
