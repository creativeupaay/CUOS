import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * WordleGuess — a single guess submitted by a player in a round.
 *
 * `feedback` is stored per letter, computed server-side.
 * This record is used to reconstruct the player's board on reconnect.
 * Feedback is sent only to the submitting player, never broadcast.
 */

export type LetterResult = 'correct' | 'present' | 'absent';

export interface IWordleGuess extends Document {
  sessionId: Types.ObjectId;
  roundId: Types.ObjectId;
  roundNumber: number;
  userId: string;
  userName: string;
  guess: string;               // normalized uppercase 5-letter word
  feedback: LetterResult[];    // array of 5 results
  guessNumber: number;         // 1–6
  isCorrect: boolean;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WordleGuessSchema = new Schema<IWordleGuess>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'WordleSession', required: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'WordleRound', required: true },
    roundNumber: { type: Number, required: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    guess: { type: String, required: true, uppercase: true, maxlength: 5, minlength: 5 },
    feedback: {
      type: [{ type: String, enum: ['correct', 'present', 'absent'] }],
      required: true,
      validate: [(arr: string[]) => arr.length === 5, 'feedback must have exactly 5 entries'],
    },
    guessNumber: { type: Number, required: true, min: 1, max: 6 },
    isCorrect: { type: Boolean, required: true, default: false },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

WordleGuessSchema.index({ sessionId: 1, roundNumber: 1, userId: 1 });
WordleGuessSchema.index({ roundId: 1, userId: 1 });

export const WordleGuess = mongoose.model<IWordleGuess>('WordleGuess', WordleGuessSchema);
