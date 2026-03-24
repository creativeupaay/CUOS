import { Types } from 'mongoose';
import { Socket } from 'socket.io';
import { IContentBlock } from '../../project/models/Note.model';

/**
 * User presence information for real-time collaboration
 */
export interface UserPresence {
  userId: string;
  userName: string;
  userPhoto: string | null;
  userEmail: string;
  socketId: string;
  lastSeen: number; // timestamp
  currentBlock: string | null; // Block ID being edited
  color: string; // Assigned avatar color
  joinedAt: number; // timestamp
}

/**
 * Note room state for managing collaboration
 */
export interface NoteRoom {
  noteId: string;
  projectId: string;
  users: Map<string, UserPresence>; // socketId -> UserPresence
  version: number; // OT version counter
  blocks: IContentBlock[]; // Current note blocks (in-memory cache)
  lastSaved: number; // timestamp
  saveScheduled: boolean;
}

/**
 * Block operation types for OT
 */
export type OperationType = 'insert' | 'update' | 'delete' | 'move';

/**
 * Block operation for operational transformation
 */
export interface BlockOperation {
  noteId: string;
  blockId: string;
  type: OperationType;
  data: any; // content, items, position, etc.
  version: number; // Note's global version at time of operation
  timestamp: number;
  userId: string;
}

/**
 * Socket with authenticated user data
 */
export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Join note room payload
 */
export interface JoinNotePayload {
  noteId: string;
  projectId: string;
}

/**
 * Leave note room payload
 */
export interface LeaveNotePayload {
  noteId: string;
}

/**
 * Update note payload
 */
export interface UpdateNotePayload extends BlockOperation {}

/**
 * Update presence payload
 */
export interface UpdatePresencePayload {
  noteId: string;
  currentBlock: string | null;
}

/**
 * Update note title payload
 */
export interface UpdateTitlePayload {
  noteId: string;
  title: string;
}

/**
 * Presence colors pool
 */
export const PRESENCE_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Orange
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E2', // Sky Blue
];

/**
 * Room cleanup configuration
 */
export const ROOM_CONFIG = {
  DISCONNECT_GRACE_PERIOD: 30000, // 30 seconds
  SAVE_DEBOUNCE_DELAY: 5000, // 5 seconds
  INACTIVE_ROOM_TIMEOUT: 3600000, // 1 hour
  MAX_BLOCKS_CACHE: 100,
  MAX_USERS_PER_ROOM: 100,
};
