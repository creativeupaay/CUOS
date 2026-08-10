/**
 * Wordle Frontend TypeScript Types
 *
 * These types mirror server public types only.
 * Secret data (targetWord during active round) is never stored here.
 */

// ─── Core Types ───────────────────────────────────────────────────────────────

export type LetterResult = 'correct' | 'present' | 'absent' | 'empty' | 'tbd';

export type WordlePhase =
  | 'LOBBY'
  | 'ROUND_START'
  | 'PLAYING'
  | 'ROUND_RESULT'
  | 'GAME_OVER';

export type WordleSessionStatus = 'lobby' | 'active' | 'finished' | 'cancelled';
export type WordleRoundPlayerStatus = 'playing' | 'solved' | 'failed' | 'timed_out';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface WordleConfig {
  gameName: string;
  totalRounds: number;
  roundDurationSec: number;
  maxGuesses: 6;
  wordPack: string;
  maxPlayers: number;
  minPlayers: number;
}

// ─── Public Player ────────────────────────────────────────────────────────────

export interface WordlePublicPlayer {
  userId: string;
  userName: string;
  isHost: boolean;
  isSpectator: boolean;
  isReady: boolean;
  totalScore: number;
}

// ─── Player Progress (safe to show — no guess letters) ────────────────────────

export interface WordlePlayerProgress {
  userId: string;
  userName: string;
  status: WordleRoundPlayerStatus;
  guessCount: number;
  roundScore: number;
}

// ─── Public Round State ───────────────────────────────────────────────────────

export interface WordlePublicRoundState {
  roundNumber: number;
  totalRounds: number;
  startedAt: string | null;
  endsAt: string | null;
  status: 'pending' | 'active' | 'finished';
  targetWord?: string; // Only present after round ends
  playerProgress: WordlePlayerProgress[];
}

// ─── Public Session State ─────────────────────────────────────────────────────

export interface WordlePublicSessionState {
  sessionId: string;
  gameType: 'wordle';
  hostUserId: string;
  status: WordleSessionStatus;
  phase: WordlePhase;
  config: WordleConfig;
  players: WordlePublicPlayer[];
  currentRound: WordlePublicRoundState | null;
  createdAt: string;
}

// ─── Guess ────────────────────────────────────────────────────────────────────

export interface WordleGuessEntry {
  guess: string;
  feedback: LetterResult[];
  guessNumber: number;
  isCorrect: boolean;
}

export interface WordleGuessResult {
  guess: string;
  feedback: LetterResult[];
  guessNumber: number;
  isCorrect: boolean;
  guessesRemaining: number;
  roundScore?: number;
}

// ─── Round Result ─────────────────────────────────────────────────────────────

export interface WordleRoundResultPayload {
  roundNumber: number;
  totalRounds: number;
  targetWord: string;
  isLastRound: boolean;
  playerResults: Array<{
    userId: string;
    userName: string;
    status: WordleRoundPlayerStatus;
    guessCount: number;
    solvedAt: string | null;
    roundScore: number;
  }>;
}

// ─── Final Game Result ────────────────────────────────────────────────────────

export interface WordleFinalResultPayload {
  sessionId: string;
  winnerId: string;
  winnerName: string;
  rankings: Array<{
    rank: number;
    userId: string;
    userName: string;
    totalScore: number;
    roundsPlayed: number;
    roundsSolved: number;
    roundScores: number[];
  }>;
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────

export type KeyStatus = 'correct' | 'present' | 'absent' | 'unused';

export type KeyboardLayout = string[][];

// ─── Session List Item (for browse page) ─────────────────────────────────────

export interface WordleSessionListItem {
  _id: string;
  gameType: 'wordle';
  status: WordleSessionStatus;
  phase: WordlePhase;
  config: WordleConfig;
  players: Array<{
    userId: string;
    userName: string;
    isHost: boolean;
    isSpectator: boolean;
    isReady: boolean;
    totalScore: number;
  }>;
  hostUserId: string;
  createdAt: string;
}

// ─── Create Session Input ─────────────────────────────────────────────────────

export interface CreateWordleSessionInput {
  gameName?: string;
  totalRounds: number;
  roundDurationSec: number;
  wordPack?: string;
  maxPlayers?: number;
  minPlayers?: number;
}
