import { Server } from 'socket.io';
import { BlockOperation, AuthenticatedSocket } from '../types/types';
import type { UserPresence } from '../types/types';
import { getRoom, getRoomName, saveTimers } from '../utils/roomManager';
import { IContentBlock } from '../../project/models/Note.model';
import { ROOM_CONFIG } from '../types/types';
import noteService from '../../project/services/note.service';
import { logger } from "../../../utils/logger";

/**
 * Apply block operation to room state
 */
export const applyOperation = (
  noteId: string,
  operation: BlockOperation
): { success: boolean; error?: string; newVersion?: number } => {
  const room = getRoom(noteId);

  if (!room) {
    return { success: false, error: 'Room not found' };
  }

  // Check version (OT conflict detection)
  if (operation.version !== room.version) {
    return {
      success: false,
      error: 'Version mismatch - please sync',
    };
  }

  // Apply operation based on type
  switch (operation.type) {
    case 'insert':
      return applyInsert(room.blocks, operation, room);

    case 'update':
      return applyUpdate(room.blocks, operation, room);

    case 'delete':
      return applyDelete(room.blocks, operation, room);

    case 'move':
      return applyMove(room.blocks, operation, room);

    default:
      return { success: false, error: 'Unknown operation type' };
  }
};

/**
 * Insert a new block
 */
const applyInsert = (
  blocks: IContentBlock[],
  operation: BlockOperation,
  room: any
): { success: boolean; error?: string; newVersion: number } => {
  const { blockId, data } = operation;

  // Check if block already exists
  if (blocks.find(b => b.id === blockId)) {
    return { success: false, error: 'Block already exists', newVersion: room.version };
  }

  // Insert block at specified position or at end
  const position = data.position !== undefined ? data.position : blocks.length;

  const newBlock: IContentBlock = {
    id: blockId,
    type: data.type,
    content: data.content,
    items: data.items,
    cloudinaryId: data.cloudinaryId,
    url: data.url,
    caption: data.caption,
  };

  blocks.splice(position, 0, newBlock);
  room.version++;

  logger.info(`[OT] Inserted block ${blockId}, version: ${room.version}`);

  return { success: true, newVersion: room.version };
};

/**
 * Update an existing block
 */
const applyUpdate = (
  blocks: IContentBlock[],
  operation: BlockOperation,
  room: any
): { success: boolean; error?: string; newVersion: number } => {
  const { blockId, data } = operation;

  const blockIndex = blocks.findIndex(b => b.id === blockId);

  if (blockIndex === -1) {
    return { success: false, error: 'Block not found', newVersion: room.version };
  }

  // Update block fields
  const block = blocks[blockIndex];

  if (data.content !== undefined) {
    block.content = data.content;
  }

  if (data.items !== undefined) {
    block.items = data.items;
  }

  if (data.caption !== undefined) {
    block.caption = data.caption;
  }

  if (data.cloudinaryId !== undefined) {
    block.cloudinaryId = data.cloudinaryId;
  }

  if (data.url !== undefined) {
    block.url = data.url;
  }

  room.version++;

  logger.info(`[OT] Updated block ${blockId}, version: ${room.version}`);

  return { success: true, newVersion: room.version };
};

/**
 * Delete a block
 */
const applyDelete = (
  blocks: IContentBlock[],
  operation: BlockOperation,
  room: any
): { success: boolean; error?: string; newVersion: number } => {
  const { blockId } = operation;

  const blockIndex = blocks.findIndex(b => b.id === blockId);

  if (blockIndex === -1) {
    return { success: false, error: 'Block not found', newVersion: room.version };
  }

  blocks.splice(blockIndex, 1);
  room.version++;

  logger.info(`[OT] Deleted block ${blockId}, version: ${room.version}`);

  return { success: true, newVersion: room.version };
};

/**
 * Move a block to a new position
 */
const applyMove = (
  blocks: IContentBlock[],
  operation: BlockOperation,
  room: any
): { success: boolean; error?: string; newVersion: number } => {
  const { blockId, data } = operation;

  const blockIndex = blocks.findIndex(b => b.id === blockId);

  if (blockIndex === -1) {
    return { success: false, error: 'Block not found', newVersion: room.version };
  }

  if (data.newPosition === undefined) {
    return { success: false, error: 'New position not specified', newVersion: room.version };
  }

  // Remove block from current position
  const [block] = blocks.splice(blockIndex, 1);

  // Insert at new position
  blocks.splice(data.newPosition, 0, block);
  room.version++;

  logger.info(`[OT] Moved block ${blockId} to position ${data.newPosition}, version: ${room.version}`);

  return { success: true, newVersion: room.version };
};

/**
 * Broadcast operation to all clients in room except sender
 */
export const broadcastOperation = (
  io: Server,
  socket: AuthenticatedSocket,
  noteId: string,
  operation: BlockOperation,
  newVersion: number
): void => {
  const roomName = getRoomName(noteId);

  socket.to(roomName).emit('note:broadcast', {
    ...operation,
    version: newVersion,
  });

  logger.info(`[OT] Broadcasted operation to room ${roomName}`);
};

/**
 * Schedule database save for a note (debounced)
 */
export const scheduleNoteSave = async (
  noteId: string,
  userId: string,
  userRole: string
): Promise<void> => {
  const room = getRoom(noteId);

  if (!room) {
    logger.error(`[OT] Cannot save - room not found for note ${noteId}`);
    return;
  }

  // Clear existing save timer
  const existingTimer = saveTimers.get(noteId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Mark save as scheduled
  room.saveScheduled = true;

  // Schedule save after debounce delay
  const timer = setTimeout(async () => {
    try {
      logger.info(`[OT] Saving note ${noteId} to database...`);

      await noteService.updateNote(noteId, userId, userRole, {
        blocks: room.blocks,
      });

      room.lastSaved = Date.now();
      room.saveScheduled = false;
      saveTimers.delete(noteId);

      logger.info(`[OT] Successfully saved note ${noteId}`);
    } catch (error: any) {
      logger.error({ context: error.message }, `[OT] Failed to save note ${noteId}:`);
      room.saveScheduled = false;
      saveTimers.delete(noteId);

      // Retry after 10 seconds
      setTimeout(() => {
        scheduleNoteSave(noteId, userId, userRole);
      }, 10000);
    }
  }, ROOM_CONFIG.SAVE_DEBOUNCE_DELAY);

  saveTimers.set(noteId, timer);
};

/**
 * Force save all notes (for graceful shutdown)
 */
export const saveAllNotes = async (): Promise<void> => {
  const { getAllRooms } = require('../utils/roomManager');
  const rooms = getAllRooms();

  logger.info(`[OT] Saving ${rooms.size} notes before shutdown...`);

  const savePromises: Promise<void>[] = [];

  for (const [noteId, room] of rooms.entries()) {
    if (room.saveScheduled || Date.now() - room.lastSaved > ROOM_CONFIG.SAVE_DEBOUNCE_DELAY) {
      // Find any user in the room to use for the save
      const anyUser = Array.from(room.users.values())[0] as UserPresence | undefined;

      if (anyUser) {
        const savePromise = noteService
          .updateNote(noteId, anyUser.userId, 'admin', {
            blocks: room.blocks,
          })
          .then(() => {
            logger.info(`[OT] Saved note ${noteId} on shutdown`);
          })
          .catch((error: any) => {
            logger.error({ context: error.message }, `[OT] Failed to save note ${noteId} on shutdown:`);
          });

        savePromises.push(savePromise);
      }
    }
  }

  await Promise.all(savePromises);
  logger.info(`[OT] Completed saving all notes`);
};

/**
 * Send sync event to client (force them to fetch latest)
 */
export const sendSyncEvent = (
  socket: AuthenticatedSocket,
  noteId: string,
  currentVersion: number
): void => {
  socket.emit('note:sync', {
    noteId,
    version: currentVersion,
    message: 'Your version is out of sync, please refresh',
  });

  logger.info(`[OT] Sent sync event to socket ${socket.id} for note ${noteId}`);
};

export default {
  applyOperation,
  broadcastOperation,
  scheduleNoteSave,
  saveAllNotes,
  sendSyncEvent,
};
