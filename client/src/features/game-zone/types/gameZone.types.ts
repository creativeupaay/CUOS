/**
 * Game Zone — Frontend TypeScript Types
 *
 * These types mirror the server's public types.
 * Hidden role information is NEVER included here.
 */

// ─── Game Phase ────────────────────────────────────────────────────────────────

export type GamePhase =
  | 'LOBBY'
  | 'ROLE_REVEAL'
  | 'CLUE'
  | 'DISCUSSION'
  | 'VOTING'
  | 'RESULT'
  | 'GAME_OVER';

// ─── Player / Session Status ──────────────────────────────────────────────────

export type SessionStatus = 'lobby' | 'active' | 'finished' | 'cancelled';
export type SessionType = 'official' | 'casual';
export type PlayerSessionStatus = 'active' | 'eliminated' | 'spectator';
export type PlayerRole = 'normal' | 'imposter';
export type WinningSide = 'team' | 'imposters';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface GameConfig {
  numImposters: number;
  wordPack: string;
  maxPlayers: number;
  minPlayers: number;
  discussionTimeSec: number;
  votingTimeSec: number;
  maxRounds: number;
}

// ─── Public Game State ────────────────────────────────────────────────────────

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
  phaseStartedAt: string | null;
  phaseEndsAt: string | null;
  currentTurnPlayerId: string | null;
  turnOrder: string[];
  confirmedCount: number;
  totalActiveCount: number;
}

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
  createdAt: string;
  
  // Game Over fields (only populated when phase === GAME_OVER)
  imposterIds?: string[];
  imposterNames?: string[];
  secretWord?: string | null;
  finalScores?: ScoreEntry[];
}

// ─── Private Role Payload (only for the requesting player) ───────────────────

export interface PrivateRolePayload {
  role: PlayerRole;
  secretWord: string | null; // null for imposters
}

// ─── Clue ─────────────────────────────────────────────────────────────────────

export interface ClueEntry {
  playerId: string;
  playerName: string;
  clue: string;
}

// ─── Vote Result ──────────────────────────────────────────────────────────────

export interface VoteResult {
  targetPlayerId: string;
  targetPlayerName: string;
  votes: number;
}

// ─── Score Entry ──────────────────────────────────────────────────────────────

export interface ScoreEntry {
  userId: string;
  userName: string;
  points: number;
  won: boolean;
  breakdown: {
    participation: number;
    survival: number;
    correctVotes: number;
    deception: number;
    winBonus: number;
  };
}

// ─── Game End Payload ─────────────────────────────────────────────────────────

export interface GameWonPayload {
  winningSide: WinningSide;
  imposterIds: string[];
  imposterNames: string[];
  secretWord: string;
  scores: ScoreEntry[];
}

// ─── Session List Item ────────────────────────────────────────────────────────

export interface GameSessionListItem {
  _id: string;
  gameType: string;
  sessionType: SessionType;
  status: SessionStatus;
  phase: GamePhase;
  config: GameConfig;
  players: Array<{ userId: string; userName: string; status: PlayerSessionStatus; isHost: boolean }>;
  hostUserId: string;
  createdAt: string;
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

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
}

// ─── Game Definition (Registry) ──────────────────────────────────────────────

export interface GameDefinition {
  id: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  minPlayers: number;
  maxPlayers: number;
  durationMin: number;
  durationMax: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  route: string;
  createRoute: string;
  available: boolean;
  icon: string; // emoji or lucide icon name
  accentColor: string;
}

// ─── Create Session Input ─────────────────────────────────────────────────────

export interface CreateSessionInput {
  sessionType: 'official' | 'casual';
  numImposters: number;
  wordPack: string;
  maxPlayers: number;
  minPlayers: number;
  discussionTimeSec: number;
  votingTimeSec: number;
  maxRounds: number;
}
