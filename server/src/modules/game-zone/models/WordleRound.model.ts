import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * WordleRound — one round within a Wordle session.
 *
 * Each round has a single targetWord (server-side only).
 * The targetWord MUST NEVER be exposed through public API responses
 * until the round status is 'finished'.
 */

export type WordleRoundStatus = 'pending' | 'active' | 'finished';

export type WordleRoundPlayerStatus = 'playing' | 'solved' | 'failed' | 'timed_out';

export interface WordleRoundPlayerState {
  userId: string;
  userName: string;
  status: WordleRoundPlayerStatus;
  guessCount: number;
  solvedAt?: Date;
  completedAt?: Date; // when they finished (solved or exhausted guesses)
  roundScore: number;
  timeBonus: number;
  guessScore: number;
}

export interface IWordleRound extends Document {
  sessionId: Types.ObjectId;
  roundNumber: number;
  targetWord: string;  // NEVER included in public API responses — select: false not used because we need it in service
  status: WordleRoundStatus;
  startedAt: Date | null;
  endsAt: Date | null;
  finishedAt: Date | null;
  players: WordleRoundPlayerState[];
  createdAt: Date;
  updatedAt: Date;
}

const WordleRoundPlayerStateSchema = new Schema<WordleRoundPlayerState>(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    status: {
      type: String,
      enum: ['playing', 'solved', 'failed', 'timed_out'],
      default: 'playing',
    },
    guessCount: { type: Number, default: 0 },
    solvedAt: { type: Date },
    completedAt: { type: Date },
    roundScore: { type: Number, default: 0 },
    timeBonus: { type: Number, default: 0 },
    guessScore: { type: Number, default: 0 },
  },
  { _id: false }
);

const WordleRoundSchema = new Schema<IWordleRound>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'WordleSession', required: true, index: true },
    roundNumber: { type: Number, required: true },
    targetWord: { type: String, required: true }, // Protected in service layer — never sent to client during play
    status: {
      type: String,
      enum: ['pending', 'active', 'finished'],
      default: 'pending',
    },
    startedAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    players: [WordleRoundPlayerStateSchema],
  },
  { timestamps: true }
);

WordleRoundSchema.index({ sessionId: 1, roundNumber: 1 }, { unique: true });
WordleRoundSchema.index({ sessionId: 1, status: 1 });

export const WordleRound = mongoose.model<IWordleRound>('WordleRound', WordleRoundSchema);
