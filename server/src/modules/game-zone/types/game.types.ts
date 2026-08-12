/**
 * Game Zone — Shared Server Types
 *
 * These types describe the authoritative game state managed by the server.
 * No hidden role information is exposed through generic types.
 */

// ─── Game Phase ──────────────────────────────────────────────────────────────

export enum GamePhase {
  LOBBY = 'LOBBY',
  ROLE_REVEAL = 'ROLE_REVEAL',
  CLUE = 'CLUE',
  DISCUSSION = 'DISCUSSION',
  VOTING = 'VOTING',
  RESULT = 'RESULT',
  GAME_OVER = 'GAME_OVER',
}

// ─── Session / Player Status ──────────────────────────────────────────────────

export type SessionStatus = 'lobby' | 'active' | 'finished' | 'cancelled';
export type SessionType = 'official' | 'casual';
export type PlayerSessionStatus = 'active' | 'eliminated' | 'spectator';
export type PlayerRole = 'normal' | 'imposter';
export type WinningSide = 'team' | 'imposters';

// ─── Game Configuration ───────────────────────────────────────────────────────

export interface GameConfig {
  numImposters: number;
  wordPack: string;
  maxPlayers: number;
  minPlayers: number;
  discussionTimeSec: number;
  votingTimeSec: number;
  maxRounds: number; // 0 = unlimited
}

// ─── Round State ──────────────────────────────────────────────────────────────

export interface RoundState {
  roundNumber: number;
  cycleNumber: number;
  secretWord: string; // Never sent to frontend directly
  phaseStartedAt: Date | null;
  phaseEndsAt: Date | null;
  currentTurnPlayerId: string | null;
  turnOrder: string[]; // Array of player userIds
  confirmedRolePlayerIds: string[]; // Players who pressed "I've Seen It"
}

// ─── Embedded Player in Session ──────────────────────────────────────────────

export interface SessionPlayer {
  userId: string;
  userName: string;
  userEmail: string;
  status: PlayerSessionStatus;
  isReady: boolean;
  joinedAt: Date;
  isHost: boolean;
}

// ─── Clue Record ─────────────────────────────────────────────────────────────

export interface ClueRecord {
  playerId: string;
  playerName: string;
  clue: string;
  roundNumber: number;
  cycleNumber: number;
  submittedAt: Date;
}

// ─── Vote Aggregation ────────────────────────────────────────────────────────

export interface VoteAggregation {
  targetPlayerId: string;
  targetPlayerName: string;
  votes: number;
}

// ─── Score Entry ─────────────────────────────────────────────────────────────

export interface ScoreEntry {
  userId: string;
  userName: string;
  points: number;
  breakdown: {
    participation: number;
    survival: number;
    correctVotes: number;
    deception: number;
    winBonus: number;
  };
}

// ─── Game Zone API Response Shapes ───────────────────────────────────────────

/**
 * Public game state — safe to send to all players.
 * Does NOT include secret words or individual roles.
 */
export interface PublicGameState {
  sessionId: string;
  gameType: string;
  sessionType: SessionType;
  hostUserId: string;
  status: SessionStatus;
  phase: GamePhase;
  config: GameConfig;
  players: PublicPlayerState[];
  currentRound: PublicRoundState | null;
  winningSide: WinningSide | null;
  createdAt: Date;
  
  // Game Over fields (only populated when phase === GAME_OVER)
  imposterIds?: string[];
  imposterNames?: string[];
  secretWord?: string | null;
  finalScores?: ScoreEntry[];
}

export interface PublicPlayerState {
  userId: string;
  userName: string;
  status: PlayerSessionStatus;
  isReady: boolean;
  isHost: boolean;
  hasConfirmedRole: boolean;
}

export interface PublicRoundState {
  roundNumber: number;
  cycleNumber: number;
  phaseStartedAt: Date | null;
  phaseEndsAt: Date | null;
  currentTurnPlayerId: string | null;
  turnOrder: string[];
  confirmedCount: number;
  totalActiveCount: number;
}

/**
 * Private role payload — returned only to the authenticated player.
 * A player NEVER receives another player's role.
 */
export interface PrivateRolePayload {
  role: PlayerRole;
  secretWord: string | null; // null for imposters
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  gamesPlayed: number;
  wins: number;
  totalPoints: number;
  roleStats?: {
    timesImposter: number;
    timesNormal: number;
  };
}
