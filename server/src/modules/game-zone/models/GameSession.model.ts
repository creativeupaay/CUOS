import mongoose, { Document, Schema, Types } from 'mongoose';
import { GamePhase, SessionStatus, SessionType, GameConfig, RoundState, SessionPlayer, WinningSide } from '../types/game.types';

export interface IGameSession extends Document {
  gameType: 'imposter';
  sessionType: SessionType;
  hostUserId: Types.ObjectId;
  status: SessionStatus;
  phase: GamePhase;
  config: GameConfig;
  players: SessionPlayer[];
  currentRound: RoundState | null;
  clues: Array<{
    playerId: string;
    playerName: string;
    clue: string;
    roundNumber: number;
    cycleNumber: number;
    submittedAt: Date;
  }>;
  winningSide: WinningSide | null;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GameConfigSchema = new Schema<GameConfig>(
  {
    numImposters: { type: Number, required: true, default: 2, min: 1 },
    wordPack: { type: String, required: true, default: 'general' },
    maxPlayers: { type: Number, required: true, default: 10 },
    minPlayers: { type: Number, required: true, default: 4 },
    discussionTimeSec: { type: Number, required: true, default: 90 },
    votingTimeSec: { type: Number, required: true, default: 30 },
    maxRounds: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const SessionPlayerSchema = new Schema<SessionPlayer>(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    status: { type: String, enum: ['active', 'eliminated', 'spectator'], default: 'active' },
    isReady: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
    isHost: { type: Boolean, default: false },
  },
  { _id: false }
);

const RoundStateSchema = new Schema<RoundState>(
  {
    roundNumber: { type: Number, required: true, default: 1 },
    cycleNumber: { type: Number, required: true, default: 1 },
    secretWord: { type: String, required: true }, // Server-side only — never bulk-sent to frontend
    phaseStartedAt: { type: Date, default: null },
    phaseEndsAt: { type: Date, default: null },
    currentTurnPlayerId: { type: String, default: null },
    turnOrder: [{ type: String }],
    confirmedRolePlayerIds: [{ type: String }],
  },
  { _id: false }
);

const ClueSchema = new Schema(
  {
    playerId: { type: String, required: true },
    playerName: { type: String, required: true },
    clue: { type: String, required: true, maxlength: 50 },
    roundNumber: { type: Number, required: true },
    cycleNumber: { type: Number, required: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const GameSessionSchema = new Schema<IGameSession>(
  {
    gameType: { type: String, required: true, enum: ['imposter'], default: 'imposter' },
    sessionType: { type: String, required: true, enum: ['official', 'casual'], default: 'casual' },
    hostUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      required: true,
      enum: ['lobby', 'active', 'finished', 'cancelled'],
      default: 'lobby',
    },
    phase: {
      type: String,
      required: true,
      enum: Object.values(GamePhase),
      default: GamePhase.LOBBY,
    },
    config: { type: GameConfigSchema, required: true },
    players: [SessionPlayerSchema],
    currentRound: { type: RoundStateSchema, default: null },
    clues: [ClueSchema],
    winningSide: { type: String, enum: ['team', 'imposters', null], default: null },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes for efficient queries
GameSessionSchema.index({ status: 1, gameType: 1 });
GameSessionSchema.index({ 'players.userId': 1, status: 1 });
GameSessionSchema.index({ hostUserId: 1 });
GameSessionSchema.index({ createdAt: -1 });

export const GameSession = mongoose.model<IGameSession>('GameSession', GameSessionSchema);
