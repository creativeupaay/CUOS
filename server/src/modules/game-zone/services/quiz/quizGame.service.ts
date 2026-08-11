/**
 * Quiz Game Service — core business logic
 *
 * HTTP-agnostic: no req/res, no socket references.
 * All functions called by the controller or socket handlers.
 *
 * Security invariants maintained in every function:
 * - correctOption never included in public state
 * - Future questions never sent
 * - Server sets all timestamps
 * - One submission per player per question (enforced at DB + service level)
 */

import { Types } from 'mongoose';
import { QuizSession, IQuizSession } from '../../models/QuizSession.model';
import { QuizQuestion } from '../../models/QuizQuestion.model';
import { QuizRound, IQuizRound } from '../../models/QuizRound.model';
import { QuizSubmission } from '../../models/QuizSubmission.model';
import { GameScore } from '../../models/GameScore.model';
import { calculateQuizScore, rankPlayers } from './quizScoring.service';
import AppError from '../../../../utils/appError';
import { logger } from '../../../../utils/logger';
import type {
  QuizPublicState,
  QuizPublicPlayer,
  QuizPublicQuestion,
  QuizLiveLeaderboardEntry,
  QuizRoundPlayerResult,
  QuizFinalPlayerResult,
  QuizPreparationStatus,
} from '../../types/quiz.types';

// ─── Create Session ───────────────────────────────────────────────────────────

export interface CreateQuizSessionInput {
  gameName: string;
  topic: string;
  totalQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  timePerQuestion: number;
  maxPlayers?: number;
  minPlayers?: number;
}

export async function createQuizSession(
  hostUserId: string,
  hostName: string,
  hostEmail: string,
  input: CreateQuizSessionInput
): Promise<IQuizSession> {
  if (input.totalQuestions < 5 || input.totalQuestions > 20) {
    throw new AppError('Total questions must be between 5 and 20', 400);
  }
  if (input.timePerQuestion < 10 || input.timePerQuestion > 60) {
    throw new AppError('Time per question must be between 10 and 60 seconds', 400);
  }

  // Sanitize topic — treat as data
  const sanitizedTopic = input.topic.replace(/[<>'"&]/g, '').trim().slice(0, 100);
  if (!sanitizedTopic) {
    throw new AppError('Topic cannot be empty', 400);
  }

  const session = await QuizSession.create({
    gameType: 'quiz',
    hostUserId: new Types.ObjectId(hostUserId),
    status: 'lobby',
    phase: 'LOBBY',
    config: {
      gameName: input.gameName.trim().slice(0, 80) || 'Quiz Battle',
      topic: sanitizedTopic,
      totalQuestions: input.totalQuestions,
      difficulty: input.difficulty,
      timePerQuestion: input.timePerQuestion,
      maxPlayers: input.maxPlayers || 20,
      minPlayers: input.minPlayers || 2,
    },
    players: [
      {
        userId: hostUserId,
        userName: hostName,
        userEmail: hostEmail,
        isHost: true,
        isSpectator: false,
        isReady: true, // host is always ready
        totalScore: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        totalResponseTimeSec: 0,
        joinedAt: new Date(),
      },
    ],
    currentQuestionIndex: -1,
    questionIds: [],
    preparationStatus: {
      totalRequired: input.totalQuestions,
      totalReady: 0,
      aiGenerated: 0,
      fallbackUsed: 0,
      generating: input.totalQuestions,
      isComplete: false,
    },
  });

  return session;
}

// ─── Join Session ─────────────────────────────────────────────────────────────

export async function joinQuizSession(
  sessionId: string,
  userId: string,
  userName: string,
  userEmail: string
): Promise<{ session: IQuizSession; isSpectator: boolean }> {
  const session = await QuizSession.findById(sessionId);
  if (!session) throw new AppError('Quiz session not found', 404);
  if (session.status === 'finished' || session.status === 'cancelled') {
    throw new AppError('This game has already ended', 400);
  }

  // Already in session?
  const existing = session.players.find((p) => p.userId === userId);
  if (existing) {
    return { session, isSpectator: existing.isSpectator };
  }

  const isLobby = session.status === 'lobby';
  const activePlayers = session.players.filter((p) => !p.isSpectator);
  const isFull = activePlayers.length >= session.config.maxPlayers;
  const isSpectator = !isLobby || isFull;

  const newPlayer = {
    userId,
    userName,
    userEmail,
    isHost: false,
    isSpectator,
    isReady: false,
    totalScore: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    totalResponseTimeSec: 0,
    joinedAt: new Date(),
  };

  const updated = await QuizSession.findOneAndUpdate(
    { _id: sessionId, 'players.userId': { $ne: userId } },
    { $push: { players: newPlayer } },
    { new: true }
  );

  if (!updated) {
    // Concurrent join — reload
    const reloaded = await QuizSession.findById(sessionId) as IQuizSession;
    const p = reloaded.players.find((pl) => pl.userId === userId);
    return { session: reloaded, isSpectator: p!.isSpectator };
  }

  return { session: updated as IQuizSession, isSpectator };
}

// ─── Leave Session ────────────────────────────────────────────────────────────

export async function leaveQuizSession(
  sessionId: string,
  userId: string
): Promise<IQuizSession> {
  const session = await QuizSession.findById(sessionId);
  if (!session) throw new AppError('Quiz session not found', 404);

  const idx = session.players.findIndex((p) => p.userId === userId);
  if (idx === -1) return session;

  session.players.splice(idx, 1);

  if (session.players.length > 0) {
    if (!session.players.some((p) => p.isHost)) {
      const newHost = session.players.find((p) => !p.isSpectator) || session.players[0];
      if (newHost) {
        newHost.isHost = true;
        session.hostUserId = new Types.ObjectId(newHost.userId);
      }
    }
  } else {
    session.status = 'cancelled';
  }

  await session.save();
  return session;
}

// ─── Toggle Ready ─────────────────────────────────────────────────────────────

export async function setQuizPlayerReady(
  sessionId: string,
  userId: string,
  isReady: boolean
): Promise<IQuizSession> {
  const session = await QuizSession.findById(sessionId);
  if (!session) throw new AppError('Quiz session not found', 404);
  if (session.phase !== 'LOBBY' && session.phase !== 'READY') {
    throw new AppError('Game has already started', 400);
  }

  const player = session.players.find((p) => p.userId === userId);
  if (!player) throw new AppError('You are not in this session', 403);
  if (player.isSpectator) throw new AppError('Spectators cannot ready up', 403);

  player.isReady = isReady;
  await session.save();
  return session;
}

// ─── Get Public State ─────────────────────────────────────────────────────────

export async function getPublicQuizState(sessionId: string): Promise<QuizPublicState> {
  const session = await QuizSession.findById(sessionId);
  if (!session) throw new AppError('Quiz session not found', 404);

  const publicPlayers: QuizPublicPlayer[] = session.players.map((p) => ({
    userId: p.userId,
    userName: p.userName,
    isHost: p.isHost,
    isSpectator: p.isSpectator,
    isReady: p.isReady,
    totalScore: p.totalScore,
    correctAnswers: p.correctAnswers,
    wrongAnswers: p.wrongAnswers,
  }));

  let currentQuestion: QuizPublicQuestion | null = null;
  let answeredUserIds: string[] = [];
  let liveLeaderboard: QuizLiveLeaderboardEntry[] = [];

  if (session.currentQuestionIndex >= 0) {
    const round = await QuizRound.findOne({
      sessionId: session._id,
      questionIndex: session.currentQuestionIndex,
    });

    if (round && round.status === 'active') {
      // Get question — never include correctOption
      const question = await QuizQuestion.findById(round.questionId)
        .select('-correctOption') // redundant since select:false in schema, but explicit
        .lean();

      if (question) {
        currentQuestion = {
          questionId: (question._id as Types.ObjectId).toString(),
          question: question.question,
          options: question.options as [string, string, string, string],
          category: question.category,
          difficulty: question.difficulty,
          questionNumber: session.currentQuestionIndex + 1,
          totalQuestions: session.config.totalQuestions,
          startedAt: round.startedAt.toISOString(),
          endsAt: round.endsAt.toISOString(),
        };
      }

      // Get who has answered (IDs only, not their choice)
      const submissions = await QuizSubmission.find({
        sessionId: session._id,
        roundId: round._id,
      }).select('userId').lean();
      answeredUserIds = submissions.map((s) => s.userId);
    }
  }

  // Build live leaderboard
  const activePlayers = session.players.filter((p) => !p.isSpectator);
  const ranked = rankPlayers(
    activePlayers.map((p) => ({
      userId: p.userId,
      userName: p.userName,
      totalScore: p.totalScore,
      correctAnswers: p.correctAnswers,
      wrongAnswers: p.wrongAnswers,
      totalResponseTimeSec: p.totalResponseTimeSec,
    }))
  );
  liveLeaderboard = ranked.map((p) => ({
    rank: p.rank,
    userId: p.userId,
    userName: p.userName,
    totalScore: p.totalScore,
    correctAnswers: p.correctAnswers,
  }));

  return {
    sessionId: (session._id as any).toString(),
    gameType: 'quiz',
    hostUserId: session.hostUserId.toString(),
    status: session.status,
    phase: session.phase,
    config: session.config,
    players: publicPlayers,
    preparationStatus: session.preparationStatus,
    currentQuestion,
    answeredUserIds,
    liveLeaderboard,
    createdAt: session.createdAt.toISOString(),
  };
}

// ─── Start Game ───────────────────────────────────────────────────────────────

export async function startQuizGame(
  sessionId: string,
  userId: string
): Promise<IQuizSession> {
  const session = await QuizSession.findById(sessionId).select('+questionIds');
  if (!session) throw new AppError('Quiz session not found', 404);
  if (session.hostUserId.toString() !== userId) {
    throw new AppError('Only the host can start the game', 403);
  }
  if (session.phase !== 'LOBBY' && session.phase !== 'READY' && session.phase !== 'PREPARING') {
    throw new AppError('Game has already started', 400);
  }

  const activePlayers = session.players.filter((p) => !p.isSpectator);
  if (activePlayers.length < session.config.minPlayers) {
    throw new AppError(`Need at least ${session.config.minPlayers} players to start`, 400);
  }

  if (!session.questionIds || session.questionIds.length === 0) {
    throw new AppError('Questions are not ready yet. Please wait.', 400);
  }

  session.status = 'active';
  session.phase = 'QUESTION'; // first question coming up
  await session.save();

  return session;
}

// ─── Start Question ───────────────────────────────────────────────────────────

export interface StartQuestionResult {
  round: IQuizRound;
  publicQuestion: QuizPublicQuestion;
}

export async function startQuestion(
  sessionId: string,
  questionIndex: number
): Promise<StartQuestionResult> {
  const session = await QuizSession.findById(sessionId).select('+questionIds');
  if (!session) throw new AppError('Quiz session not found', 404);
  if (session.status !== 'active') throw new AppError('Game is not active', 400);

  const questionIds = session.questionIds;
  if (questionIndex >= questionIds.length) {
    throw new AppError('Question index out of range', 400);
  }

  const questionId = questionIds[questionIndex];
  const question = await QuizQuestion.findById(questionId).lean();
  if (!question) throw new AppError('Question not found', 404);

  const now = new Date();
  const endsAt = new Date(now.getTime() + session.config.timePerQuestion * 1000);

  // Create the round document
  const round = await QuizRound.create({
    sessionId: session._id,
    questionId: new Types.ObjectId(questionId),
    questionIndex,
    startedAt: now,
    endsAt,
    status: 'active',
    endedEarly: false,
  });

  // Update session state
  await QuizSession.findByIdAndUpdate(sessionId, {
    currentQuestionIndex: questionIndex,
    phase: 'QUESTION',
  });

  // Build public question (NO correctOption)
  const publicQuestion: QuizPublicQuestion = {
    questionId: (question._id as Types.ObjectId).toString(),
    roundId: (round._id as Types.ObjectId).toString(),
    question: question.question,
    options: question.options as [string, string, string, string],
    category: question.category,
    difficulty: question.difficulty,
    questionNumber: questionIndex + 1,
    totalQuestions: session.config.totalQuestions,
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
  };

  return { round, publicQuestion };
}

// ─── Submit Answer ────────────────────────────────────────────────────────────

export interface SubmitAnswerInput {
  sessionId: string;
  roundId: string;
  userId: string;
  userName: string;
  selectedOption: number;
  submissionId: string; // client UUID for idempotency
}

export interface SubmitAnswerResult {
  isCorrect: boolean;
  scoreChange: number;
  responseTimeSec: number;
  locked: boolean;
  allPlayersAnswered: boolean;
}

export async function submitQuizAnswer(input: SubmitAnswerInput): Promise<SubmitAnswerResult> {
  const { sessionId, roundId, userId, userName, selectedOption, submissionId } = input;

  // Check if already submitted (idempotency)
  const existing = await QuizSubmission.findOne({ submissionId });
  if (existing) {
    // Return the original result
    return {
      isCorrect: existing.isCorrect,
      scoreChange: existing.scoreChange,
      responseTimeSec: existing.responseTimeSec,
      locked: true,
      allPlayersAnswered: false,
    };
  }

  // Load round
  let round = await QuizRound.findById(roundId);
  if (!round || round.sessionId.toString() !== sessionId) {
    round = await QuizRound.findOne({ sessionId, status: 'active' });
  }
  if (!round) {
    throw new AppError('Round not found', 404);
  }
  const actualRoundId = (round._id as Types.ObjectId).toString();
  if (round.status !== 'active') {
    throw new AppError('This question has already ended', 400);
  }

  const now = new Date();

  // Server-side time check — no client timestamps trusted
  if (now > round.endsAt) {
    throw new AppError('Time has expired for this question', 400);
  }

  // Load session to verify player + get config
  const session = await QuizSession.findById(sessionId);
  if (!session) throw new AppError('Quiz session not found', 404);

  const player = session.players.find((p) => p.userId === userId);
  if (!player) throw new AppError('You are not in this session', 403);
  if (player.isSpectator) throw new AppError('Spectators cannot submit answers', 403);

  // Check if already answered this question (belt + suspenders beyond DB unique index)
  const alreadyAnswered = await QuizSubmission.findOne({
    sessionId: new Types.ObjectId(sessionId),
    roundId: new Types.ObjectId(actualRoundId),
    userId,
  });
  if (alreadyAnswered) {
    return {
      isCorrect: alreadyAnswered.isCorrect,
      scoreChange: alreadyAnswered.scoreChange,
      responseTimeSec: alreadyAnswered.responseTimeSec,
      locked: true,
      allPlayersAnswered: false,
    };
  }

  // Validate option
  if (selectedOption < 0 || selectedOption > 3) {
    throw new AppError('Invalid option selected', 400);
  }

  // Get question with correctOption (server-side ONLY)
  const question = await QuizQuestion.findById(round.questionId).select('+correctOption');
  if (!question) throw new AppError('Question not found', 404);

  // Calculate score (server-side)
  const responseTimeSec = (now.getTime() - round.startedAt.getTime()) / 1000;
  const scoringResult = calculateQuizScore({
    selectedOption,
    correctOption: question.correctOption,
    responseTimeSec,
    totalTimeSec: session.config.timePerQuestion,
  });

  // Persist submission (DB unique index enforces one-per-player-per-question)
  try {
    await QuizSubmission.create({
      sessionId: new Types.ObjectId(sessionId),
      roundId: new Types.ObjectId(actualRoundId),
      questionIndex: round.questionIndex,
      userId,
      userName,
      selectedOption,
      isCorrect: scoringResult.isCorrect,
      submittedAt: now,
      responseTimeSec: Math.round(responseTimeSec * 10) / 10,
      scoreChange: scoringResult.scoreChange,
      submissionId,
    });
  } catch (err: any) {
    if (err.code === 11000) {
      // Duplicate key — already answered
      const existing2 = await QuizSubmission.findOne({
        sessionId: new Types.ObjectId(sessionId),
        roundId: new Types.ObjectId(roundId),
        userId,
      });
      if (existing2) {
        return {
          isCorrect: existing2.isCorrect,
          scoreChange: existing2.scoreChange,
          responseTimeSec: existing2.responseTimeSec,
          locked: true,
          allPlayersAnswered: false,
        };
      }
    }
    throw err;
  }

  // Update player totals in session
  await QuizSession.findOneAndUpdate(
    { _id: sessionId, 'players.userId': userId },
    {
      $inc: {
        'players.$.totalScore': scoringResult.scoreChange,
        'players.$.correctAnswers': scoringResult.isCorrect ? 1 : 0,
        'players.$.wrongAnswers': !scoringResult.isCorrect && selectedOption !== null ? 1 : 0,
        'players.$.totalResponseTimeSec': scoringResult.isCorrect ? responseTimeSec : 0,
      },
    }
  );

  // Check if all active players have answered
  const updatedSession = await QuizSession.findById(sessionId);
  const activePlayers = updatedSession!.players.filter((p) => !p.isSpectator);
  const submissionCount = await QuizSubmission.countDocuments({
    sessionId: new Types.ObjectId(sessionId),
    roundId: new Types.ObjectId(roundId),
  });
  const allPlayersAnswered = submissionCount >= activePlayers.length;

  return {
    isCorrect: scoringResult.isCorrect,
    scoreChange: scoringResult.scoreChange,
    responseTimeSec: Math.round(responseTimeSec * 10) / 10,
    locked: true,
    allPlayersAnswered,
  };
}

// ─── End Question ─────────────────────────────────────────────────────────────

export interface EndQuestionResult {
  correctOption: number;
  explanation: string;
  results: QuizRoundPlayerResult[];
  liveLeaderboard: QuizLiveLeaderboardEntry[];
  isLastQuestion: boolean;
}

export async function endQuestion(
  sessionId: string,
  questionIndex: number
): Promise<EndQuestionResult> {
  const session = await QuizSession.findById(sessionId);
  if (!session) throw new AppError('Quiz session not found', 404);

  const round = await QuizRound.findOne({
    sessionId: session._id,
    questionIndex,
    status: 'active',
  });
  if (!round) throw new AppError('No active round found', 400);

  // Mark round as ended
  round.status = 'ended';
  await round.save();

  // Get question with correctOption (server-side reveal)
  const question = await QuizQuestion.findById(round.questionId).select('+correctOption');
  if (!question) throw new AppError('Question not found', 404);

  // Update session phase
  const isLastQuestion = questionIndex >= session.config.totalQuestions - 1;
  await QuizSession.findByIdAndUpdate(sessionId, {
    phase: isLastQuestion ? 'FINAL_RESULT' : 'QUESTION_RESULT',
  });

  // Fetch ALL submissions for this session to compute 100% accurate player totals
  const allSubmissions = await QuizSubmission.find({
    sessionId: session._id,
  }).lean();

  // Get submissions for current round
  const currentRoundSubmissions = allSubmissions.filter(
    (s) => s.roundId?.toString() === (round as any)._id?.toString()
  );

  // Compute exact player totals from session submissions
  const activePlayers = session.players.filter((p) => !p.isSpectator);
  for (const player of activePlayers) {
    const pSubmissions = allSubmissions.filter(
      (s) => s.userId?.toString() === player.userId?.toString()
    );
    player.totalScore = Math.max(0, pSubmissions.reduce((sum, s) => sum + (s.scoreChange || 0), 0));
    player.correctAnswers = pSubmissions.filter((s) => s.isCorrect === true).length;
    player.wrongAnswers = pSubmissions.filter((s) => s.isCorrect === false).length;
    player.totalResponseTimeSec = Math.round(
      pSubmissions.filter((s) => s.isCorrect === true).reduce((sum, s) => sum + (s.responseTimeSec || 0), 0) * 10
    ) / 10;
  }

  // Update session document in DB with computed totals
  await session.save();

  // Build per-player results for current round
  const results: QuizRoundPlayerResult[] = activePlayers.map((player) => {
    const submission = currentRoundSubmissions.find(
      (s) => s.userId?.toString() === player.userId?.toString()
    );
    return {
      userId: player.userId,
      userName: player.userName,
      isCorrect: submission ? submission.isCorrect : null,
      scoreChange: submission ? submission.scoreChange : 0,
      totalScore: player.totalScore,
      rank: 0, // filled below
      responseTimeSec: submission ? submission.responseTimeSec : null,
    };
  });

  // Rank results
  const ranked = rankPlayers(
    activePlayers.map((p) => ({
      userId: p.userId,
      userName: p.userName,
      totalScore: p.totalScore,
      correctAnswers: p.correctAnswers,
      wrongAnswers: p.wrongAnswers,
      totalResponseTimeSec: p.totalResponseTimeSec,
    }))
  );
  const rankMap = new Map(ranked.map((r) => [r.userId, r.rank]));
  results.forEach((r) => { r.rank = rankMap.get(r.userId) || 0; });

  // Live leaderboard
  const liveLeaderboard: QuizLiveLeaderboardEntry[] = ranked.map((r) => ({
    rank: r.rank,
    userId: r.userId,
    userName: r.userName,
    totalScore: r.totalScore,
    correctAnswers: r.correctAnswers,
  }));

  // Persist game scores to GameScore model if last question
  if (isLastQuestion) {
    await QuizSession.findByIdAndUpdate(sessionId, {
      status: 'finished',
      phase: 'GAME_OVER',
      finishedAt: new Date(),
    });

    // Save to GameScore for leaderboard
    for (const player of activePlayers) {
      const rank = rankMap.get(player.userId) || activePlayers.length;
      const won = rank === 1;
      try {
        await GameScore.create({
          sessionId: session._id,
          userId: player.userId,
          userName: player.userName,
          userEmail: player.userEmail,
          gameType: 'quiz',
          role: 'normal',
          won,
          winningSide: null,
          score: player.totalScore,
        });
      } catch (err) {
        logger.error({ err }, `[QuizGame] Failed to save GameScore for ${player.userId}`);
      }
    }
  }

  return {
    correctOption: question.correctOption,
    explanation: question.explanation,
    results,
    liveLeaderboard,
    isLastQuestion,
  };
}

// ─── Get Final Results ────────────────────────────────────────────────────────

export async function getQuizFinalResults(sessionId: string): Promise<QuizFinalPlayerResult[]> {
  const session = await QuizSession.findById(sessionId);
  if (!session) throw new AppError('Quiz session not found', 404);

  const allSubmissions = await QuizSubmission.find({
    sessionId: session._id,
  }).lean();

  const activePlayers = session.players.filter((p) => !p.isSpectator);
  for (const player of activePlayers) {
    const pSubmissions = allSubmissions.filter(
      (s) => s.userId?.toString() === player.userId?.toString()
    );
    player.totalScore = Math.max(0, pSubmissions.reduce((sum, s) => sum + (s.scoreChange || 0), 0));
    player.correctAnswers = pSubmissions.filter((s) => s.isCorrect === true).length;
    player.wrongAnswers = pSubmissions.filter((s) => s.isCorrect === false).length;
    player.totalResponseTimeSec = Math.round(
      pSubmissions.filter((s) => s.isCorrect === true).reduce((sum, s) => sum + (s.responseTimeSec || 0), 0) * 10
    ) / 10;
  }

  const ranked = rankPlayers(
    activePlayers.map((p) => ({
      userId: p.userId,
      userName: p.userName,
      totalScore: p.totalScore,
      correctAnswers: p.correctAnswers,
      wrongAnswers: p.wrongAnswers,
      totalResponseTimeSec: p.totalResponseTimeSec,
    }))
  );

  return ranked.map((r) => ({
    rank: r.rank,
    userId: r.userId,
    userName: r.userName,
    totalScore: r.totalScore,
    correctAnswers: r.correctAnswers,
    wrongAnswers: r.wrongAnswers,
    accuracy: r.correctAnswers + r.wrongAnswers > 0
      ? Math.round((r.correctAnswers / (r.correctAnswers + r.wrongAnswers)) * 100)
      : 0,
    avgResponseTimeSec:
      r.correctAnswers > 0
        ? Math.round((r.totalResponseTimeSec / r.correctAnswers) * 10) / 10
        : 0,
  }));
}

// ─── End Session ──────────────────────────────────────────────────────────────

export async function endQuizSession(
  sessionId: string,
  userId: string
): Promise<IQuizSession> {
  const session = await QuizSession.findById(sessionId);
  if (!session) throw new AppError('Quiz session not found', 404);
  if (session.hostUserId.toString() !== userId) {
    throw new AppError('Only the host can end the game', 403);
  }
  if (session.status === 'finished' || session.status === 'cancelled') {
    throw new AppError('Game is already over', 400);
  }

  session.status = 'finished';
  session.phase = 'GAME_OVER';
  session.finishedAt = new Date();
  await session.save();
  return session;
}

// ─── List Sessions ────────────────────────────────────────────────────────────

export async function listQuizSessions() {
  return QuizSession.find({
    status: { $in: ['lobby', 'active'] },
  })
    .select('_id gameType status phase config players hostUserId createdAt preparationStatus')
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
}

// ─── Get Preparation Status ───────────────────────────────────────────────────

export async function getQuizPreparationStatus(
  sessionId: string
): Promise<QuizPreparationStatus> {
  const session = await QuizSession.findById(sessionId);
  if (!session) throw new AppError('Quiz session not found', 404);
  return session.preparationStatus;
}
