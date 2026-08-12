import mongoose, { Document, Schema, Types } from 'mongoose';

export type QuestionSource = 'ai' | 'fallback';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

/**
 * QuizQuestion — stores individual questions in the question pool.
 *
 * correctOption is ONLY readable server-side.
 * It is NEVER included in public DTOs sent to clients before reveal.
 */
export interface IQuizQuestion extends Document {
  question: string;
  options: [string, string, string, string]; // exactly 4
  correctOption: number; // 0–3 — server-side only
  explanation: string;
  topic: string;
  category: string; // normalized category for fallback matching
  difficulty: QuestionDifficulty;
  source: QuestionSource;
  sessionId?: Types.ObjectId | null; // reserved for a specific session
  usageCount: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuizQuestionSchema = new Schema<IQuizQuestion>(
  {
    question: { type: String, required: true, maxlength: 500 },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => v.length === 4,
        message: 'Exactly 4 options are required',
      },
    },
    correctOption: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
      // This field is excluded from all public queries.
      // Always use .select('+correctOption') when you need it server-side.
      select: false,
    },
    explanation: { type: String, required: true, maxlength: 1000 },
    topic: { type: String, required: true, maxlength: 100 },
    category: { type: String, required: true, maxlength: 100 },
    difficulty: {
      type: String,
      required: true,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    source: {
      type: String,
      required: true,
      enum: ['ai', 'fallback'],
    },
    sessionId: { type: Schema.Types.ObjectId, ref: 'QuizSession', default: null },
    usageCount: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes for efficient querying
QuizQuestionSchema.index({ sessionId: 1, difficulty: 1 });
QuizQuestionSchema.index({ category: 1, difficulty: 1, active: 1 });
QuizQuestionSchema.index({ topic: 1, difficulty: 1, active: 1 });
QuizQuestionSchema.index({ source: 1, active: 1 });
QuizQuestionSchema.index({ createdAt: -1 });

export const QuizQuestion = mongoose.model<IQuizQuestion>('QuizQuestion', QuizQuestionSchema);
