/**
 * Wordle Game — Server-side TypeScript Types
 *
 * These types describe the authoritative state managed by the server.
 * Public types (safe to send to clients) are clearly marked.
 * Types containing secret data (targetWord) must NEVER appear in public API responses.
 */

import type { LetterResult } from '../models/WordleGuess.model';
import type { WordlePhase, WordleSessionStatus } from '../models/WordleSession.model';
import type { WordleRoundPlayerStatus } from '../models/WordleRound.model';

// Re-export for convenience
export type { LetterResult, WordlePhase, WordleSessionStatus, WordleRoundPlayerStatus };

// ─── Public Player State (safe to send) ──────────────────────────────────────

export interface WordlePublicPlayer {
  userId: string;
  userName: string;
  isHost: boolean;
  isSpectator: boolean;
  isReady: boolean;
  totalScore: number;
}

// ─── Round Player Progress (safe to broadcast) ───────────────────────────────
// Does NOT include guesses or letters — just safe competitive info

export interface WordlePlayerProgress {
  userId: string;
  userName: string;
  status: WordleRoundPlayerStatus;
  guessCount: number;
  roundScore: number;
}

// ─── Public Round State (safe to send — NO targetWord) ───────────────────────

export interface WordlePublicRoundState {
  roundNumber: number;
  totalRounds: number;
  startedAt: string | null;
  endsAt: string | null;
  status: 'pending' | 'active' | 'finished';
  // targetWord is ONLY added here AFTER round is finished
  targetWord?: string;
  playerProgress: WordlePlayerProgress[];
}

// ─── Public Session State (safe to send) ─────────────────────────────────────

export interface WordlePublicSessionState {
  sessionId: string;
  gameType: 'wordle';
  hostUserId: string;
  status: WordleSessionStatus;
  phase: WordlePhase;
  config: {
    gameName: string;
    totalRounds: number;
    roundDurationSec: number;
    maxGuesses: 6;
    wordPack: string;
    maxPlayers: number;
    minPlayers: number;
  };
  players: WordlePublicPlayer[];
  currentRound: WordlePublicRoundState | null;
  createdAt: string;
}

// ─── Private Guess Result (sent only to submitting player's socket) ───────────

export interface WordleGuessResult {
  guess: string;
  feedback: LetterResult[];
  guessNumber: number;
  isCorrect: boolean;
  guessesRemaining: number;
  roundScore?: number;  // only when isCorrect or last guess
}

// ─── Round Result (safe after round ends — reveals targetWord) ────────────────

export interface WordleRoundResult {
  roundNumber: number;
  targetWord: string;        // Safe to reveal after round ends
  playerResults: Array<{
    userId: string;
    userName: string;
    status: WordleRoundPlayerStatus;
    guessCount: number;
    solvedAt: string | null;
    roundScore: number;
  }>;
  nextRoundStartsAt?: string; // server-controlled countdown
}

// ─── Final Game Result ────────────────────────────────────────────────────────

export interface WordleFinalResult {
  sessionId: string;
  rankings: Array<{
    rank: number;
    userId: string;
    userName: string;
    totalScore: number;
    roundsPlayed: number;
    roundsSolved: number;
    roundScores: number[];
  }>;
  winnerId: string;
  winnerName: string;
}

// ─── Score Entry (for leaderboard) ───────────────────────────────────────────

export interface WordleScoreEntry {
  userId: string;
  userName: string;
  totalScore: number;
  roundsPlayed: number;
  roundsSolved: number;
  avgGuesses: number;
  avgCompletionTimeSec: number;
  won: boolean;
}
