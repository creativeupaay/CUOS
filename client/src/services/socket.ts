import { io, Socket } from 'socket.io-client';

// Determine base URL for Socket.io connection
const getBaseURL = (): string => {
  const apiBaseURL = import.meta.env.VITE_API_BASE_URL;

  if (apiBaseURL) {
    // Remove /api/v1 suffix if present
    return apiBaseURL.replace(/\/api\/v1$/, '');
  }

  // Default to localhost for development
  return 'http://localhost:8000';
};

const BASE_URL = getBaseURL();

// Optional non-cookie token fallback (some environments may store tokens in localStorage).
const getFallbackToken = (): string | null => {
  try {
    return localStorage.getItem('accessToken');
  } catch {
    return null;
  }
};

/**
 * Socket.io client instance
 */
export const socket: Socket = io(BASE_URL, {
  autoConnect: false, // Don't connect immediately, connect when needed
  withCredentials: true,
  auth: (cb) => {
    const token = getFallbackToken();
    cb({ token });
  },
  transports: ['websocket', 'polling'], // WebSocket preferred, polling fallback
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

/**
 * Connect to Socket.io server
 */
export const connectSocket = (): void => {
  if (!socket.connected) {
    console.log('[Socket] Connecting to server...');
    socket.connect();
  }
};

/**
 * Disconnect from Socket.io server
 */
export const disconnectSocket = (): void => {
  if (socket.connected) {
    console.log('[Socket] Disconnecting from server...');
    socket.disconnect();
  }
};

/**
 * Check if socket is connected
 */
export const isSocketConnected = (): boolean => {
  return socket.connected;
};

// Log connection events
socket.on('connect', () => {
  console.log('[Socket] Connected successfully');
});

socket.on('disconnect', (reason) => {
  console.log('[Socket] Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('[Socket] Connection error:', error.message);
});

socket.on('error', (error) => {
  console.error('[Socket] Error:', error);
});

export default socket;
