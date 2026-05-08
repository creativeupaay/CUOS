import { NoteRoom, ROOM_CONFIG } from '../types/types';
import { logger } from "../../../utils/logger";

/**
 * Global storage for all note rooms
 */
export const noteRooms = new Map<string, NoteRoom>();

/**
 * Timers for delayed operations
 */
export const disconnectTimers = new Map<string, NodeJS.Timeout>();
export const saveTimers = new Map<string, NodeJS.Timeout>();
export const inactivityTimers = new Map<string, NodeJS.Timeout>();

/**
 * Get or create a note room
 */
export const getOrCreateRoom = (noteId: string, projectId: string): NoteRoom => {
  let room = noteRooms.get(noteId);

  if (!room) {
    room = {
      noteId,
      projectId,
      users: new Map(),
      version: 0,
      blocks: [],
      lastSaved: Date.now(),
      saveScheduled: false,
    };
    noteRooms.set(noteId, room);
    logger.info(`[RoomManager] Created room for note ${noteId}`);
  }

  // Clear inactivity timer if it exists
  const inactivityTimer = inactivityTimers.get(noteId);
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimers.delete(noteId);
  }

  return room;
};

/**
 * Get an existing room
 */
export const getRoom = (noteId: string): NoteRoom | undefined => {
  return noteRooms.get(noteId);
};

/**
 * Delete a room if empty
 */
export const cleanupRoomIfEmpty = (noteId: string): void => {
  const room = noteRooms.get(noteId);

  if (room && room.users.size === 0) {
    // Schedule room deletion after inactivity period
    const timer = setTimeout(() => {
      const currentRoom = noteRooms.get(noteId);
      if (currentRoom && currentRoom.users.size === 0) {
        noteRooms.delete(noteId);
        inactivityTimers.delete(noteId);
        logger.info(`[RoomManager] Deleted inactive room for note ${noteId}`);
      }
    }, ROOM_CONFIG.INACTIVE_ROOM_TIMEOUT);

    inactivityTimers.set(noteId, timer);
  }
};

/**
 * Get all active note IDs for a project
 */
export const getProjectNotes = (projectId: string): string[] => {
  const noteIds: string[] = [];

  for (const [noteId, room] of noteRooms.entries()) {
    if (room.projectId === projectId) {
      noteIds.push(noteId);
    }
  }

  return noteIds;
};

/**
 * Get room name for Socket.io
 */
export const getRoomName = (noteId: string): string => {
  return `note:${noteId}`;
};

/**
 * Clear all timers for a note
 */
export const clearNoteTimers = (noteId: string): void => {
  // Clear save timer
  const saveTimer = saveTimers.get(noteId);
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimers.delete(noteId);
  }

  // Clear inactivity timer
  const inactivityTimer = inactivityTimers.get(noteId);
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimers.delete(noteId);
  }
};

/**
 * Clear disconnect timer for a socket
 */
export const clearDisconnectTimer = (socketId: string): void => {
  const timer = disconnectTimers.get(socketId);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(socketId);
  }
};

/**
 * Get all rooms
 */
export const getAllRooms = (): Map<string, NoteRoom> => {
  return noteRooms;
};

/**
 * Get room statistics
 */
export const getRoomStats = () => {
  const stats = {
    totalRooms: noteRooms.size,
    totalUsers: 0,
    roomDetails: [] as Array<{
      noteId: string;
      projectId: string;
      userCount: number;
      version: number;
    }>,
  };

  for (const [noteId, room] of noteRooms.entries()) {
    stats.totalUsers += room.users.size;
    stats.roomDetails.push({
      noteId,
      projectId: room.projectId,
      userCount: room.users.size,
      version: room.version,
    });
  }

  return stats;
};
