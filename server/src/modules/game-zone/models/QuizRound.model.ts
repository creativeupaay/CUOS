import mongoose, { Document, Schema, Types } from 'mongoose';

export type QuizRoundStatus = 'active' | 'ended';

/**
 * QuizRound — represents a single question's active round within a game session.
 * One round per question per session.
 */
export interface IQuizRound extends Document {
  sessionId: Types.ObjectId;
  questionId: Types.ObjectId;
  questionIndex: number; // 0-based
  startedAt: Date;
  endsAt: Date;
  status: QuizRoundStatus;
  endedEarly: boolean; // true if all players answered before timer
  createdAt: Date;
  updatedAt: Date;
}

const QuizRoundSchema = new Schema<IQuizRound>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'QuizSession', required: true, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'QuizQuestion', required: true },
    questionIndex: { type: Number, required: true },
    startedAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ['active', 'ended'],
      default: 'active',
    },
    endedEarly: { type: Boolean, default: false },
  },
  { timestamps: true }
);

QuizRoundSchema.index({ sessionId: 1, questionIndex: 1 }, { unique: true });
QuizRoundSchema.index({ sessionId: 1, status: 1 });

export const QuizRound = mongoose.model<IQuizRound>('QuizRound', QuizRoundSchema);
