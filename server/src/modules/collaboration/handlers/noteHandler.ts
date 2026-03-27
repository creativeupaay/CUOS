import { Server, Socket } from 'socket.io';
import { Types } from 'mongoose';
import {
  AuthenticatedSocket,
  JoinNotePayload,
  LeaveNotePayload,
  UpdateNotePayload,
  UpdatePresencePayload,
  UpdateTitlePayload,
  ROOM_CONFIG,
} from '../types/types';
import {
  getOrCreateRoom,
  getRoom,
  getRoomName,
  cleanupRoomIfEmpty,
  clearDisconnectTimer,
  disconnectTimers,
} from '../utils/roomManager';
import {
  createUserPresence,
  addUserToRoom,
  removeUserFromRoom,
  updateUserPresence,
  getRoomUsers,
  broadcastPresence,
  sendRoomState,
  removeUserFromAllRooms,
} from '../services/presenceService';
import otService from '../services/otService';
import { Project } from '../../project/models/Project.model';
import { Employee } from '../../hrms/models/Employee.model';
import { Note } from '../../project/models/Note.model';
import { Partner } from '../../partners/models/Partner.model';
import { PartnerEmployee } from '../../partners/models/PartnerEmployee.model';

/**
 * Check if user has access to a project
 */
const checkProjectAccess = async (
  userId: string,
  projectId: string,
  role: string
): Promise<boolean> => {
  try {
    const normalizedRole = role.toLowerCase();

    // Admins bypass assignment checks.
    if (normalizedRole === 'super-admin' || normalizedRole === 'super_admin' || normalizedRole === 'admin') {
      return true;
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return false;
    }

    // Project creator always has access.
    if (project.createdBy.toString() === userId) {
      return true;
    }

    // Partner users can only access their own partner-bound projects.
    if (normalizedRole === 'partner') {
      let partner = await Partner.findOne({ userId: new Types.ObjectId(userId) }).select('_id').lean();

      if (!partner) {
        const partnerEmployee = await PartnerEmployee.findById(userId).select('partnerId').lean();
        if (partnerEmployee?.partnerId) {
          partner = { _id: partnerEmployee.partnerId } as any;
        }
      }

      if (!partner || !project.partnerId) {
        return false;
      }

      // Handle both populated and non-populated partnerId
      const projectPartnerId = project.partnerId
        ? (project.partnerId as any)._id?.toString() || project.partnerId.toString()
        : null;

      return projectPartnerId === partner._id.toString();
    }

    // Find employee record
    const employee = await Employee.findOne({ userId: new Types.ObjectId(userId) });

    if (!employee) {
      return false;
    }

    // Check if user is assigned to project
    const isAssigned = project.assignees.some(
      (assignee) => assignee.memberType === 'employee' && assignee.employeeId?.toString() === employee._id.toString()
    );

    return isAssigned;
  } catch (error) {
    console.error('[NoteHandler] Error checking project access:', error);
    return false;
  }
};

/**
 * Setup note collaboration event handlers
 */
export const setupNoteHandlers = (socket: AuthenticatedSocket, io: Server) => {
  /**
   * Join note room
   */
  socket.on('note:join', async (payload: JoinNotePayload) => {
    try {
      const { noteId, projectId } = payload;

      console.log(`[NoteHandler] User ${socket.data.userId} joining note ${noteId}`);

      // Verify project access
      const hasAccess = await checkProjectAccess(
        socket.data.userId,
        projectId,
        socket.data.role
      );

      if (!hasAccess) {
        socket.emit('note:error', {
          message: 'You do not have access to this project',
        });
        return;
      }

      // Verify note exists and belongs to project
      const note = await Note.findOne({ _id: noteId, projectId: new Types.ObjectId(projectId) });

      if (!note) {
        socket.emit('note:error', {
          message: 'Note not found',
        });
        return;
      }

      // Check if room is at capacity
      const room = getRoom(noteId);
      if (room && room.users.size >= ROOM_CONFIG.MAX_USERS_PER_ROOM) {
        socket.emit('note:error', {
          message: 'Room is at capacity',
        });
        return;
      }

      // Create or get room
      const noteRoom = getOrCreateRoom(noteId, projectId);

      // Initialize blocks if empty (first join)
      if (noteRoom.blocks.length === 0 && note.blocks) {
        noteRoom.blocks = JSON.parse(JSON.stringify(note.blocks));
        console.log(`[NoteHandler] Initialized room with ${noteRoom.blocks.length} blocks`);
      }

      // Create user presence
      const presence = await createUserPresence(socket, noteId);

      // Add user to room (in-memory)
      addUserToRoom(noteId, presence);

      // Join Socket.io room
      socket.join(getRoomName(noteId));

      // Send current room state to joiner
      sendRoomState(socket, noteId);

      // Broadcast new user to others
      broadcastPresence(io, noteId, presence, 'user-joined');

      // Acknowledge join
      socket.emit('note:joined', {
        noteId,
        version: noteRoom.version,
        users: getRoomUsers(noteId),
        message: 'Successfully joined note',
      });

      console.log(`[NoteHandler] User ${presence.userName} joined note ${noteId}`);
    } catch (error: any) {
      console.error('[NoteHandler] Error joining note:', error);
      socket.emit('note:error', {
        message: 'Failed to join note',
      });
    }
  });

  /**
   * Leave note room
   */
  socket.on('note:leave', (payload: LeaveNotePayload) => {
    try {
      const { noteId } = payload;

      console.log(`[NoteHandler] User ${socket.data.userId} leaving note ${noteId}`);

      // Remove user from room
      const presence = removeUserFromRoom(noteId, socket.id);

      if (presence) {
        // Leave Socket.io room
        socket.leave(getRoomName(noteId));

        // Broadcast user left
        broadcastPresence(io, noteId, presence, 'user-left');

        // Cleanup room if empty
        cleanupRoomIfEmpty(noteId);

        console.log(`[NoteHandler] User ${presence.userName} left note ${noteId}`);
      }
    } catch (error: any) {
      console.error('[NoteHandler] Error leaving note:', error);
    }
  });

  /**
   * Update note (block operation)
   */
  socket.on('note:update', async (operation: UpdateNotePayload) => {
    try {
      const { noteId } = operation;

      console.log(
        `[NoteHandler] Received update for note ${noteId}, block ${operation.blockId}, type: ${operation.type}`
      );

      const room = getRoom(noteId);
      if (!room || !room.users.has(socket.id)) {
        socket.emit('note:error', {
          message: 'Join the note before sending updates',
        });
        return;
      }

      // Update user's last seen
      updateUserPresence(noteId, socket.id, { lastSeen: Date.now() });

      // Apply operation using OT service
      const result = otService.applyOperation(noteId, operation);

      if (!result.success) {
        console.error(`[NoteHandler] Operation failed: ${result.error}`);

        // Send sync event if version mismatch
        if (result.error?.includes('Version mismatch')) {
          const room = getRoom(noteId);
          if (room) {
            otService.sendSyncEvent(socket, noteId, room.version);
          }
        } else {
          socket.emit('note:error', {
            message: result.error || 'Operation failed',
          });
        }

        return;
      }

      // Broadcast operation to other users in room
      otService.broadcastOperation(io, socket, noteId, operation, result.newVersion!);

      // Acknowledge to sender
      socket.emit('note:ack', {
        operationId: operation.timestamp,
        version: result.newVersion,
      });

      // Schedule database save (debounced)
      await otService.scheduleNoteSave(noteId, socket.data.userId, socket.data.role);

      console.log(
        `[NoteHandler] Applied operation for note ${noteId}, new version: ${result.newVersion}`
      );
    } catch (error: any) {
      console.error('[NoteHandler] Error updating note:', error);
      socket.emit('note:error', {
        message: 'Failed to update note',
      });
    }
  });

  /**
   * Update presence (cursor position, current block)
   */
  socket.on('note:presence', (payload: UpdatePresencePayload) => {
    try {
      const { noteId, currentBlock } = payload;

      const room = getRoom(noteId);
      if (!room || !room.users.has(socket.id)) {
        return;
      }

      // Update user presence
      updateUserPresence(noteId, socket.id, {
        currentBlock,
        lastSeen: Date.now(),
      });

      if (room) {
        const presence = room.users.get(socket.id);

        if (presence) {
          // Broadcast presence update
          broadcastPresence(io, noteId, presence, 'user-updated');
        }
      }
    } catch (error: any) {
      console.error('[NoteHandler] Error updating presence:', error);
    }
  });

  /**
   * Realtime note title update
   */
  socket.on('note:title', (payload: UpdateTitlePayload) => {
    try {
      const { noteId, title } = payload;

      const room = getRoom(noteId);
      if (!room || !room.users.has(socket.id)) {
        return;
      }

      socket.to(getRoomName(noteId)).emit('note:title', {
        noteId,
        title,
      });
    } catch (error: any) {
      console.error('[NoteHandler] Error broadcasting title:', error);
    }
  });

  /**
   * Handle disconnect
   */
  socket.on('disconnect', () => {
    console.log(`[NoteHandler] User ${socket.data.userId} disconnected`);

    // Schedule delayed cleanup (grace period for reconnection)
    const timer = setTimeout(() => {
      // Remove user from all rooms
      const noteIds = removeUserFromAllRooms(socket.id, io);

      // Cleanup empty rooms
      noteIds.forEach(noteId => cleanupRoomIfEmpty(noteId));

      // Clear disconnect timer
      disconnectTimers.delete(socket.id);

      console.log(`[NoteHandler] Cleaned up user ${socket.data.userId} from ${noteIds.length} rooms`);
    }, ROOM_CONFIG.DISCONNECT_GRACE_PERIOD);

    disconnectTimers.set(socket.id, timer);
  });

  /**
   * Handle reconnection
   */
  socket.on('connect', () => {
    // Clear disconnect timer if user reconnects
    clearDisconnectTimer(socket.id);
    console.log(`[NoteHandler] User ${socket.data.userId} reconnected`);
  });
};
