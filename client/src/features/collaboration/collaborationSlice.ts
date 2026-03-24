import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { CollaborationState, UserPresence } from './types/types';

const initialState: CollaborationState = {
  activeUsers: [],
  myPresence: null,
  isConnected: false,
  version: 0,
  currentNoteId: null,
};

const collaborationSlice = createSlice({
  name: 'collaboration',
  initialState,
  reducers: {
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },

    setCurrentNoteId: (state, action: PayloadAction<string | null>) => {
      state.currentNoteId = action.payload;
    },

    setMyPresence: (state, action: PayloadAction<UserPresence | null>) => {
      state.myPresence = action.payload;
    },

    setActiveUsers: (state, action: PayloadAction<UserPresence[]>) => {
      state.activeUsers = action.payload;
    },

    addUser: (state, action: PayloadAction<UserPresence>) => {
      const existingIndex = state.activeUsers.findIndex(
        u => u.userId === action.payload.userId && u.socketId === action.payload.socketId
      );

      if (existingIndex === -1) {
        state.activeUsers.push(action.payload);
      }
    },

    removeUser: (state, action: PayloadAction<string>) => {
      // Remove by socketId
      state.activeUsers = state.activeUsers.filter(u => u.socketId !== action.payload);
    },

    updateUserPresence: (
      state,
      action: PayloadAction<{ socketId: string; updates: Partial<UserPresence> }>
    ) => {
      const user = state.activeUsers.find(u => u.socketId === action.payload.socketId);

      if (user) {
        Object.assign(user, action.payload.updates);
      }
    },

    setVersion: (state, action: PayloadAction<number>) => {
      state.version = action.payload;
    },

    incrementVersion: (state) => {
      state.version += 1;
    },

    resetCollaboration: (state) => {
      state.activeUsers = [];
      state.myPresence = null;
      state.version = 0;
      state.currentNoteId = null;
      // Keep isConnected state
    },
  },
});

export const {
  setConnected,
  setCurrentNoteId,
  setMyPresence,
  setActiveUsers,
  addUser,
  removeUser,
  updateUserPresence,
  setVersion,
  incrementVersion,
  resetCollaboration,
} = collaborationSlice.actions;

export default collaborationSlice.reducer;
