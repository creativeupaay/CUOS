import type { NoteBlock } from '../../project/types/types';

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
 * Collaboration state
 */
export interface CollaborationState {
  activeUsers: UserPresence[];
  myPresence: UserPresence | null;
  isConnected: boolean;
  version: number;
  currentNoteId: string | null;
}

/**
 * Socket event payloads
 */
export interface JoinNotePayload {
  noteId: string;
  projectId: string;
}

export interface LeaveNotePayload {
  noteId: string;
}

export interface UpdateNotePayload extends BlockOperation { }

export interface UpdatePresencePayload {
  noteId: string;
  currentBlock: string | null;
}

export interface UpdateTitlePayload {
  noteId: string;
  title: string;
}

/**
 * Socket event responses
 */
export interface NoteJoinedResponse {
  noteId: string;
  version: number;
  users: UserPresence[];
  message: string;
}

export interface NoteRoomStateResponse {
  noteId: string;
  users: UserPresence[];
  version: number;
  blocks: NoteBlock[];
}

export interface NoteBroadcastResponse extends BlockOperation {
  version: number;
}

export interface NotePresenceResponse {
  event: 'user-joined' | 'user-left' | 'user-updated';
  presence: UserPresence;
}

export interface NoteSyncResponse {
  noteId: string;
  version: number;
  message: string;
}

export interface NoteAckResponse {
  operationId: number;
  version: number;
}

export interface NoteTitleResponse {
  noteId: string;
  title: string;
}

export interface NoteErrorResponse {
  message: string;
}

/**
 * Presence colors (matching backend)
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
