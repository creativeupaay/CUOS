import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type {
  PublicGameState,
  GamePhase,
  ClueEntry,
  VoteResult,
  ScoreEntry,
  WinningSide,
} from '../../../types/gameZone.types';

/**
 * Imposter Game Redux Slice
 *
 * Stores transient UI/game state for the current active session.
 * Does NOT store hidden role information (that is fetched separately via RTK Query).
 * This slice is ONLY for the imposter game — no other game touches it.
 */

interface ImposterGameState {
  // Current session
  currentSessionId: string | null;
  gameState: PublicGameState | null;

  // Phase-specific UI state
  currentClues: ClueEntry[];
  voteResults: VoteResult | null;
  voteResultsList: VoteResult[];
  eliminatedPlayerId: string | null;
  eliminatedWasImposter: boolean | null;

  // Game over state
  winningSide: WinningSide | null;
  imposterIds: string[];
  imposterNames: string[];
  secretWord: string | null;
  finalScores: ScoreEntry[];

  // UI state
  mySelectedVote: string | null;
  isSubmittingClue: boolean;
  isSubmittingVote: boolean;
  socketConnected: boolean;
  lastError: string | null;
}

const initialState: ImposterGameState = {
  currentSessionId: null,
  gameState: null,
  currentClues: [],
  voteResults: null,
  voteResultsList: [],
  eliminatedPlayerId: null,
  eliminatedWasImposter: null,
  winningSide: null,
  imposterIds: [],
  imposterNames: [],
  secretWord: null,
  finalScores: [],
  mySelectedVote: null,
  isSubmittingClue: false,
  isSubmittingVote: false,
  socketConnected: false,
  lastError: null,
};

const imposterSlice = createSlice({
  name: 'imposter',
  initialState,
  reducers: {
    setCurrentSession(state, action: PayloadAction<{ sessionId: string; gameState: PublicGameState }>) {
      state.currentSessionId = action.payload.sessionId;
      state.gameState = action.payload.gameState;
      state.currentClues = [];
      state.voteResults = null;
      state.voteResultsList = [];
      state.eliminatedPlayerId = null;
      state.eliminatedWasImposter = null;
      state.winningSide = null;
      state.imposterIds = [];
      state.imposterNames = [];
      state.secretWord = null;
      state.finalScores = [];
      state.mySelectedVote = null;
    },

    updateGamePhase(state, action: PayloadAction<{ phase: GamePhase; phaseStartedAt?: string; phaseEndsAt?: string; currentTurnPlayerId?: string | null; turnOrder?: string[] }>) {
      if (state.gameState) {
        state.gameState.phase = action.payload.phase;
        if (state.gameState.currentRound) {
          if (action.payload.phaseStartedAt !== undefined) {
            state.gameState.currentRound.phaseStartedAt = action.payload.phaseStartedAt;
          }
          if (action.payload.phaseEndsAt !== undefined) {
            state.gameState.currentRound.phaseEndsAt = action.payload.phaseEndsAt;
          }
          if (action.payload.currentTurnPlayerId !== undefined) {
            state.gameState.currentRound.currentTurnPlayerId = action.payload.currentTurnPlayerId;
          }
          if (action.payload.turnOrder !== undefined) {
            state.gameState.currentRound.turnOrder = action.payload.turnOrder;
          }
        }
      }
    },

    updatePlayer(state, action: PayloadAction<{ playerId: string; updates: Partial<{ isReady: boolean; status: string; hasConfirmedRole: boolean }> }>) {
      if (state.gameState) {
        const player = state.gameState.players.find((p: any) => p.userId === action.payload.playerId);
        if (player) {
          Object.assign(player, action.payload.updates);
        }
      }
    },

    addPlayer(state, action: PayloadAction<any>) {
      if (state.gameState && !state.gameState.players.find((p: any) => p.userId === action.payload.userId)) {
        state.gameState.players.push(action.payload);
      }
    },

    removePlayer(state, action: PayloadAction<string>) {
      if (state.gameState) {
        state.gameState.players = state.gameState.players.filter((p: any) => p.userId !== action.payload);
      }
    },

    addClue(state, action: PayloadAction<ClueEntry>) {
      const exists = state.currentClues.find((c: any) => c.playerId === action.payload.playerId);
      if (!exists) {
        state.currentClues.push(action.payload);
      }
    },

    clearClues(state) {
      state.currentClues = [];
    },

    setVoteResults(state, action: PayloadAction<VoteResult[]>) {
      state.voteResultsList = action.payload;
    },

    setEliminatedPlayer(state, action: PayloadAction<{ playerId: string; wasImposter: boolean }>) {
      state.eliminatedPlayerId = action.payload.playerId;
      state.eliminatedWasImposter = action.payload.wasImposter;
      if (state.gameState) {
        const player = state.gameState.players.find((p: any) => p.userId === action.payload.playerId);
        if (player) player.status = 'eliminated';
      }
    },

    setGameOver(state, action: PayloadAction<{ winningSide: WinningSide; imposterIds: string[]; imposterNames: string[]; secretWord: string; scores: ScoreEntry[] }>) {
      state.winningSide = action.payload.winningSide;
      state.imposterIds = action.payload.imposterIds;
      state.imposterNames = action.payload.imposterNames;
      state.secretWord = action.payload.secretWord;
      state.finalScores = action.payload.scores;
      if (state.gameState) {
        state.gameState.phase = 'GAME_OVER';
        state.gameState.winningSide = action.payload.winningSide;
      }
    },

    setMyVote(state, action: PayloadAction<string>) {
      state.mySelectedVote = action.payload;
    },

    setSocketConnected(state, action: PayloadAction<boolean>) {
      state.socketConnected = action.payload;
    },

    setError(state, action: PayloadAction<string | null>) {
      state.lastError = action.payload;
    },

    startNextCycle(state, action: PayloadAction<{ roundNumber: number; cycleNumber: number; turnOrder: string[]; currentTurnPlayerId: string }>) {
      if (state.gameState?.currentRound) {
        state.gameState.currentRound.roundNumber = action.payload.roundNumber;
        state.gameState.currentRound.cycleNumber = action.payload.cycleNumber;
        state.gameState.currentRound.turnOrder = action.payload.turnOrder;
        state.gameState.currentRound.currentTurnPlayerId = action.payload.currentTurnPlayerId;
        state.gameState.phase = 'CLUE';
      }
      state.currentClues = [];
      state.voteResultsList = [];
      state.eliminatedPlayerId = null;
      state.eliminatedWasImposter = null;
      state.mySelectedVote = null;
    },

    resetImposterGame(state) {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setCurrentSession,
  updateGamePhase,
  updatePlayer,
  addPlayer,
  removePlayer,
  addClue,
  clearClues,
  setVoteResults,
  setEliminatedPlayer,
  setGameOver,
  setMyVote,
  setSocketConnected,
  setError,
  startNextCycle,
  resetImposterGame,
} = imposterSlice.actions;

export default imposterSlice.reducer;
