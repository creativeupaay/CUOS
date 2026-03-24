import { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import debounce from 'lodash.debounce';
import { socket, connectSocket } from '../../../services/socket';
import {
  setConnected,
  setCurrentNoteId,
  setActiveUsers,
  addUser,
  removeUser,
  updateUserPresence,
  setVersion,
} from '../collaborationSlice';
import type {
  BlockOperation,
  UserPresence,
  NoteJoinedResponse,
  NoteRoomStateResponse,
  NoteBroadcastResponse,
  NoteAckResponse,
  NotePresenceResponse,
  NoteSyncResponse,
  NoteErrorResponse,
  JoinNotePayload,
  LeaveNotePayload,
  UpdatePresencePayload,
  UpdateTitlePayload,
  NoteTitleResponse,
} from '../types/types';
import type { RootState } from '../../../app/store';

interface UseNoteCollaborationProps {
  noteId: string;
  projectId: string;
  onRemoteUpdate?: (operation: NoteBroadcastResponse) => void;
  onRemoteTitleUpdate?: (title: string) => void;
  onRoomState?: (state: NoteRoomStateResponse) => void;
  onSyncRequired?: (version: number) => void;
  onError?: (message: string) => void;
}

interface UseNoteCollaborationReturn {
  activeUsers: UserPresence[];
  myPresence: UserPresence | null;
  isConnected: boolean;
  version: number;
  broadcastChange: (operation: Omit<BlockOperation, 'noteId' | 'timestamp' | 'userId' | 'version'>) => void;
  broadcastTitleChange: (title: string) => void;
  updatePresence: (currentBlock: string | null) => void;
}

export const useNoteCollaboration = ({
  noteId,
  projectId,
  onRemoteUpdate,
  onRemoteTitleUpdate,
  onRoomState,
  onSyncRequired,
  onError,
}: UseNoteCollaborationProps): UseNoteCollaborationReturn => {
  const dispatch = useDispatch();
  const collaboration = useSelector((state: RootState) => state.collaboration);
  const isJoinedRef = useRef(false);
  const versionRef = useRef(0);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  const onRemoteTitleUpdateRef = useRef(onRemoteTitleUpdate);
  const onRoomStateRef = useRef(onRoomState);
  const onSyncRequiredRef = useRef(onSyncRequired);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    versionRef.current = collaboration.version;
  }, [collaboration.version]);

  useEffect(() => {
    onRemoteUpdateRef.current = onRemoteUpdate;
  }, [onRemoteUpdate]);

  useEffect(() => {
    onRemoteTitleUpdateRef.current = onRemoteTitleUpdate;
  }, [onRemoteTitleUpdate]);

  useEffect(() => {
    onRoomStateRef.current = onRoomState;
  }, [onRoomState]);

  useEffect(() => {
    onSyncRequiredRef.current = onSyncRequired;
  }, [onSyncRequired]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  /**
   * Join note room
   */
  const joinNoteRoom = useCallback(() => {
    if (isJoinedRef.current) return;

    const payload: JoinNotePayload = { noteId, projectId };
    socket.emit('note:join', payload);

    console.log('[Collaboration] Joining note room:', noteId);
  }, [noteId, projectId]);

  /**
   * Leave note room
   */
  const leaveNoteRoom = useCallback(() => {
    if (!isJoinedRef.current) return;

    const payload: LeaveNotePayload = { noteId };
    socket.emit('note:leave', payload);
    isJoinedRef.current = false;

    console.log('[Collaboration] Leaving note room:', noteId);
  }, [noteId]);

  /**
   * Broadcast block change
   */
  const broadcastChange = useCallback(
    (operation: Omit<BlockOperation, 'noteId' | 'timestamp' | 'userId' | 'version'>) => {
      if (!socket.connected || !isJoinedRef.current) {
        console.warn('[Collaboration] Cannot broadcast - socket not connected');
        return;
      }

      const outgoingVersion = versionRef.current;
      const payload: BlockOperation = {
        ...operation,
        noteId,
        timestamp: Date.now(),
        userId: '', // Server will populate from socket data
        version: outgoingVersion,
      };

      socket.emit('note:update', payload);

      // Optimistically bump version to avoid stale-version bursts while typing fast.
      versionRef.current = outgoingVersion + 1;
      dispatch(setVersion(versionRef.current));

      console.log('[Collaboration] Broadcasted change:', operation.type, operation.blockId);
    },
    [noteId, dispatch]
  );

  /**
   * Update presence (debounced for cursor/block position)
   */
  const updatePresence = useCallback(
    debounce((currentBlock: string | null) => {
      if (!socket.connected) return;

      const payload: UpdatePresencePayload = {
        noteId,
        currentBlock,
      };

      socket.emit('note:presence', payload);
    }, 1000),
    [noteId]
  );

  /**
   * Broadcast title change
   */
  const broadcastTitleChange = useCallback(
    (title: string) => {
      if (!socket.connected || !isJoinedRef.current) {
        return;
      }

      const payload: UpdateTitlePayload = { noteId, title };
      socket.emit('note:title', payload);
    },
    [noteId]
  );

  useEffect(() => {
    return () => {
      updatePresence.cancel();
    };
  }, [updatePresence]);

  /**
   * Setup socket event  listeners
   */
  useEffect(() => {
    // Connect socket
    connectSocket();

    // If this hook mounts after an existing socket connection,
    // ensure UI state reflects that immediately.
    if (socket.connected) {
      dispatch(setConnected(true));
    }

    // Connection state handlers
    const handleConnect = () => {
      dispatch(setConnected(true));
      console.log('[Collaboration] Socket connected');

      // Join note room on connect
      if (noteId && projectId) {
        joinNoteRoom();
      }
    };

    const handleDisconnect = () => {
      dispatch(setConnected(false));
      isJoinedRef.current = false;
      console.log('[Collaboration] Socket disconnected');
    };

    // Note collaboration event handlers
    const handleNoteJoined = (response: NoteJoinedResponse) => {
      console.log('[Collaboration] Successfully joined note:', response);
      isJoinedRef.current = true;
      versionRef.current = response.version;
      dispatch(setVersion(response.version));
      dispatch(setActiveUsers(response.users));
    };

    const handleRoomState = (response: NoteRoomStateResponse) => {
      console.log('[Collaboration] Received room state:', response);
      versionRef.current = response.version;
      dispatch(setVersion(response.version));
      dispatch(setActiveUsers(response.users));

      if (onRoomStateRef.current) {
        onRoomStateRef.current(response);
      }
    };

    const handleBroadcast = (operation: NoteBroadcastResponse) => {
      console.log('[Collaboration] Received broadcast:', operation);
      versionRef.current = operation.version;
      dispatch(setVersion(operation.version));

      // Call callback to update note blocks
      if (onRemoteUpdateRef.current) {
        onRemoteUpdateRef.current(operation);
      }
    };

    const handleAck = (response: NoteAckResponse) => {
      versionRef.current = response.version;
      dispatch(setVersion(response.version));
    };

    const handlePresence = (response: NotePresenceResponse) => {
      console.log('[Collaboration] Presence update:', response.event, response.presence);

      if (response.event === 'user-joined') {
        dispatch(addUser(response.presence));
      } else if (response.event === 'user-left') {
        dispatch(removeUser(response.presence.socketId));
      } else if (response.event === 'user-updated') {
        dispatch(
          updateUserPresence({
            socketId: response.presence.socketId,
            updates: response.presence,
          })
        );
      }
    };

    const handleSync = (response: NoteSyncResponse) => {
      console.warn('[Collaboration] Sync required:', response);
      versionRef.current = response.version;
      dispatch(setVersion(response.version));

      // Ask server for fresh room state so client can self-heal.
      socket.emit('note:join', { noteId, projectId } as JoinNotePayload);

      // Call callback to refresh note from server
      if (onSyncRequiredRef.current) {
        onSyncRequiredRef.current(response.version);
      }
    };

    const handleError = (response: NoteErrorResponse) => {
      console.error('[Collaboration] Error:', response.message);
      isJoinedRef.current = false;

      // Call error callback
      if (onErrorRef.current) {
        onErrorRef.current(response.message);
      }
    };

    const handleTitle = (response: NoteTitleResponse) => {
      if (onRemoteTitleUpdateRef.current) {
        onRemoteTitleUpdateRef.current(response.title);
      }
    };

    // Attach event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('note:joined', handleNoteJoined);
    socket.on('note:room-state', handleRoomState);
    socket.on('note:broadcast', handleBroadcast);
    socket.on('note:ack', handleAck);
    socket.on('note:presence', handlePresence);
    socket.on('note:sync', handleSync);
    socket.on('note:error', handleError);
    socket.on('note:title', handleTitle);

    // If already connected, join immediately
    if (socket.connected && noteId && projectId) {
      joinNoteRoom();
    }

    // Cleanup on unmount
    return () => {
      leaveNoteRoom();

      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('note:joined', handleNoteJoined);
      socket.off('note:room-state', handleRoomState);
      socket.off('note:broadcast', handleBroadcast);
      socket.off('note:ack', handleAck);
      socket.off('note:presence', handlePresence);
      socket.off('note:sync', handleSync);
      socket.off('note:error', handleError);
      socket.off('note:title', handleTitle);

      // Do not dispatch reset here; cleanup can run repeatedly in dev/StrictMode
      // and trigger nested store updates.
    };
  }, [noteId, projectId, dispatch, joinNoteRoom, leaveNoteRoom]);

  /**
   * Set current note ID in Redux
   */
  useEffect(() => {
    dispatch(setCurrentNoteId(noteId));
  }, [noteId, dispatch]);

  return {
    activeUsers: collaboration.activeUsers,
    myPresence: collaboration.myPresence,
    isConnected: collaboration.isConnected,
    version: collaboration.version,
    broadcastChange,
    broadcastTitleChange,
    updatePresence,
  };
};
