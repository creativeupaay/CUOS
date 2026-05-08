import { Server } from 'socket.io';
import { Types } from 'mongoose';
import { UserPresence, PRESENCE_COLORS, AuthenticatedSocket } from '../types/types';
import { getRoom, getRoomName } from '../utils/roomManager';
import { User } from '../../auth/models/User.model';
import { Employee } from '../../hrms/models/Employee.model';
import { logger } from "../../../utils/logger";

/**
 * Get user data for presence (name and profile photo from Employee model)
 */
export const getUserData = async (userId: string): Promise<{ name: string; photo: string | null; email: string }> => {
  try {
    // Fetch user to get name and email
    const user = await User.findById(userId).select('name email').lean();

    if (!user) {
      throw new Error('User not found');
    }

    // Try to fetch employee data for profile photo
    const employee = await Employee.findOne({ userId: new Types.ObjectId(userId) })
      .select('profilePhoto')
      .lean();

    return {
      name: user.name,
      email: user.email,
      photo: employee?.profilePhoto?.url || null,
    };
  } catch (error) {
    logger.error({ context: error }, '[PresenceService] Error fetching user data:');
    throw error;
  }
};

/**
 * Assign a color from the presence color pool
 */
export const assignPresenceColor = (existingColors: string[]): string => {
  // Find first unused color
  const availableColor = PRESENCE_COLORS.find(color => !existingColors.includes(color));

  // If all colors in use, cycle through
  return availableColor || PRESENCE_COLORS[existingColors.length % PRESENCE_COLORS.length];
};

/**
 * Create user presence object
 */
export const createUserPresence = async (
  socket: AuthenticatedSocket,
  noteId: string
): Promise<UserPresence> => {
  const userData = await getUserData(socket.data.userId);

  // Get existing colors in room
  const room = getRoom(noteId);
  const existingColors = room
    ? Array.from(room.users.values()).map(u => u.color)
    : [];

  const color = assignPresenceColor(existingColors);

  return {
    userId: socket.data.userId,
    userName: userData.name,
    userPhoto: userData.photo,
    userEmail: userData.email,
    socketId: socket.id,
    lastSeen: Date.now(),
    currentBlock: null,
    color,
    joinedAt: Date.now(),
  };
};

/**
 * Add user to note room
 */
export const addUserToRoom = (
  noteId: string,
  presence: UserPresence
): void => {
  const room = getRoom(noteId);

  if (!room) {
    logger.error(`[PresenceService] Room not found for note ${noteId}`);
    return;
  }

  room.users.set(presence.socketId, presence);
  logger.info(`[PresenceService] User ${presence.userName} joined note ${noteId}`);
};

/**
 * Remove user from note room
 */
export const removeUserFromRoom = (
  noteId: string,
  socketId: string
): UserPresence | null => {
  const room = getRoom(noteId);

  if (!room) {
    return null;
  }

  const presence = room.users.get(socketId);

  if (presence) {
    room.users.delete(socketId);
    logger.info(`[PresenceService] User ${presence.userName} left note ${noteId}`);
  }

  return presence || null;
};

/**
 * Update user presence (current block, last seen)
 */
export const updateUserPresence = (
  noteId: string,
  socketId: string,
  updates: Partial<Pick<UserPresence, 'currentBlock' | 'lastSeen'>>
): void => {
  const room = getRoom(noteId);

  if (!room) {
    return;
  }

  const presence = room.users.get(socketId);

  if (presence) {
    if (updates.currentBlock !== undefined) {
      presence.currentBlock = updates.currentBlock;
    }
    if (updates.lastSeen !== undefined) {
      presence.lastSeen = updates.lastSeen;
    }
  }
};

/**
 * Get all users in a note room
 */
export const getRoomUsers = (noteId: string): UserPresence[] => {
  const room = getRoom(noteId);

  if (!room) {
    return [];
  }

  return Array.from(room.users.values());
};

/**
 * Get user editing a specific block
 */
export const getUserEditingBlock = (noteId: string, blockId: string): UserPresence | null => {
  const users = getRoomUsers(noteId);
  return users.find(u => u.currentBlock === blockId) || null;
};

/**
 * Broadcast presence update to room
 */
export const broadcastPresence = (
  io: Server,
  noteId: string,
  presence: UserPresence,
  event: 'user-joined' | 'user-left' | 'user-updated'
): void => {
  const roomName = getRoomName(noteId);

  io.to(roomName).emit('note:presence', {
    event,
    presence,
  });
};

/**
 * Send current room state to a socket
 */
export const sendRoomState = (
  socket: AuthenticatedSocket,
  noteId: string
): void => {
  const room = getRoom(noteId);

  if (!room) {
    return;
  }

  socket.emit('note:room-state', {
    noteId,
    users: Array.from(room.users.values()),
    version: room.version,
    blocks: room.blocks,
  });
};

/**
 * Remove user from all rooms (on disconnect)
 */
export const removeUserFromAllRooms = (socketId: string, io: Server): string[] => {
  const noteIds: string[] = [];
  const { noteRooms } = require('../utils/roomManager');

  for (const [noteId, room] of noteRooms.entries()) {
    const presence = room.users.get(socketId);

    if (presence) {
      room.users.delete(socketId);
      noteIds.push(noteId);

      // Broadcast user left
      broadcastPresence(io, noteId, presence, 'user-left');
    }
  }

  return noteIds;
};
