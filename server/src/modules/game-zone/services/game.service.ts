import { Types } from 'mongoose';
import { GameSession, IGameSession } from '../models/GameSession.model';
import { GamePlayer } from '../models/GamePlayer.model';
import { GameVote } from '../models/GameVote.model';
import { GameScore } from '../models/GameScore.model';
import { GamePhase, PublicGameState, PublicPlayerState, PublicRoundState, PrivateRolePayload, SessionType, ScoreEntry } from '../types/game.types';
import { CreateSessionInput } from '../validators/game.validator';
import AppError from '../../../utils/appError';
import { selectImposters, validateImposterCount, generateTurnOrder } from '../utils/imposterSelection';
import { getRandomWord } from '../utils/wordPacks';

/**
 * Game Service — core business logic.
 * HTTP-agnostic: no req/res objects, no socket references.
 */

// ─── Create Session ───────────────────────────────────────────────────────────

export async function createGameSession(
  hostUserId: string,
  hostName: string,
  hostEmail: string,
  input: CreateSessionInput
): Promise<IGameSession> {
  const validation = validateImposterCount(input.maxPlayers, input.numImposters);
  if (!validation.valid) {
    throw new AppError(validation.reason || 'Invalid imposter count', 400);
  }

  const session = await GameSession.create({
    gameType: 'imposter',
    sessionType: input.sessionType,
    hostUserId: new Types.ObjectId(hostUserId),
    status: 'lobby',
    phase: GamePhase.LOBBY,
    config: {
      numImposters: input.numImposters,
      wordPack: input.wordPack,
      maxPlayers: input.maxPlayers,
      minPlayers: input.minPlayers,
      discussionTimeSec: input.discussionTimeSec,
      votingTimeSec: input.votingTimeSec,
      maxRounds: input.maxRounds,
    },
    players: [
      {
        userId: hostUserId,
        userName: hostName,
        userEmail: hostEmail,
        status: 'active',
        isReady: false,
        isHost: true,
        joinedAt: new Date(),
      },
    ],
  });

  return session;
}

// ─── Join Session ─────────────────────────────────────────────────────────────

export async function joinGameSession(
  sessionId: string,
  userId: string,
  userName: string,
  userEmail: string
): Promise<{ session: IGameSession; isSpectator: boolean }> {
  const session = await GameSession.findById(sessionId);
  if (!session) throw new AppError('Game session not found', 404);
  if (session.status === 'finished' || session.status === 'cancelled') {
    throw new AppError('This game has already ended', 400);
  }

  const existingPlayer = session.players.find((p) => p.userId === userId);
  if (existingPlayer) {
    // Player already in session — reconnect
    return { session, isSpectator: existingPlayer.status === 'spectator' };
  }

  const isLobby = session.status === 'lobby';
  const isFull = session.players.filter(p => p.status !== 'spectator').length >= session.config.maxPlayers;

  if (!isLobby || isFull) {
    // Late joiner — add as spectator
    session.players.push({
      userId,
      userName,
      userEmail,
      status: 'spectator',
      isReady: false,
      isHost: false,
      joinedAt: new Date(),
    });
    await session.save();
    return { session, isSpectator: true };
  }

  session.players.push({
    userId,
    userName,
    userEmail,
    status: 'active',
    isReady: false,
    isHost: false,
    joinedAt: new Date(),
  });
  await session.save();
  return { session, isSpectator: false };
}

// ─── Leave Session ────────────────────────────────────────────────────────────

export async function leaveGameSession(
  sessionId: string,
  userId: string
): Promise<IGameSession> {
  const session = await GameSession.findById(sessionId);
  if (!session) throw new AppError('Game session not found', 404);

  const playerIndex = session.players.findIndex((p) => p.userId === userId);
  if (playerIndex === -1) return session;

  session.players.splice(playerIndex, 1);

  // If host left and others remain, transfer host
  if (session.players.length > 0) {
    const newHost = session.players.find(p => p.status === 'active') || session.players[0];
    if (newHost) newHost.isHost = true;
    session.hostUserId = new Types.ObjectId(newHost.userId);
  } else {
    // No players left — cancel
    session.status = 'cancelled';
  }

  await session.save();
  return session;
}

// ─── Toggle Ready ─────────────────────────────────────────────────────────────

export async function setPlayerReady(
  sessionId: string,
  userId: string,
  isReady: boolean
): Promise<IGameSession> {
  const session = await GameSession.findById(sessionId);
  if (!session) throw new AppError('Game session not found', 404);
  if (session.phase !== GamePhase.LOBBY) throw new AppError('Game has already started', 400);

  const player = session.players.find((p) => p.userId === userId);
  if (!player) throw new AppError('You are not in this game session', 403);

  player.isReady = isReady;
  await session.save();
  return session;
}

// ─── Update Config ────────────────────────────────────────────────────────────

export async function updateSessionConfig(
  sessionId: string,
  userId: string,
  updates: Partial<IGameSession['config']>
): Promise<IGameSession> {
  const session = await GameSession.findById(sessionId);
  if (!session) throw new AppError('Game session not found', 404);
  if (session.hostUserId.toString() !== userId) throw new AppError('Only the host can update settings', 403);
  if (session.phase !== GamePhase.LOBBY) throw new AppError('Cannot change settings after game starts', 400);

  Object.assign(session.config, updates);
  await session.save();
  return session;
}

// ─── Start Game ───────────────────────────────────────────────────────────────

export async function startGame(
  sessionId: string,
  userId: string
): Promise<{ session: IGameSession; roleAssignments: Array<{ userId: string; role: string }> }> {
  const session = await GameSession.findById(sessionId);
  if (!session) throw new AppError('Game session not found', 404);
  if (session.hostUserId.toString() !== userId) throw new AppError('Only the host can start the game', 403);
  if (session.phase !== GamePhase.LOBBY) throw new AppError('Game has already started', 400);

  const activePlayers = session.players.filter((p) => p.status === 'active');
  if (activePlayers.length < session.config.minPlayers) {
    throw new AppError(`Need at least ${session.config.minPlayers} players to start`, 400);
  }

  const validation = validateImposterCount(activePlayers.length, session.config.numImposters);
  if (!validation.valid) {
    throw new AppError(validation.reason || 'Invalid imposter configuration', 400);
  }

  // Assign roles
  const roleAssignments = selectImposters(
    activePlayers.map((p) => p.userId),
    session.config.numImposters
  );

  // Persist to GamePlayer collection (role is hidden here)
  await GamePlayer.deleteMany({ sessionId: session._id });
  await GamePlayer.insertMany(
    activePlayers.map((p) => {
      const assignment = roleAssignments.find((r) => r.userId === p.userId)!;
      return {
        sessionId: session._id,
        userId: p.userId,
        userName: p.userName,
        userEmail: p.userEmail,
        role: assignment.role,
        status: 'active',
        isHost: p.isHost,
        hasConfirmedRole: false,
      };
    })
  );

  // Pick secret word
  const secretWord = getRandomWord(session.config.wordPack);

  // Build turn order
  const turnOrder = generateTurnOrder(activePlayers.map((p) => p.userId));

  // Update session
  session.status = 'active';
  session.phase = GamePhase.ROLE_REVEAL;
  session.currentRound = {
    roundNumber: 1,
    cycleNumber: 1,
    secretWord,
    phaseStartedAt: new Date(),
    phaseEndsAt: new Date(Date.now() + 120_000), // 2 min to confirm role
    currentTurnPlayerId: turnOrder[0],
    turnOrder,
    confirmedRolePlayerIds: [],
  };

  await session.save();
  return { session, roleAssignments };
}

// ─── Confirm Role ─────────────────────────────────────────────────────────────

export async function confirmRole(
  sessionId: string,
  userId: string
): Promise<{ session: IGameSession; allConfirmed: boolean }> {
  const session = await GameSession.findById(sessionId);
  if (!session) throw new AppError('Game session not found', 404);
  if (session.phase !== GamePhase.ROLE_REVEAL) throw new AppError('Not in role reveal phase', 400);

  const player = session.players.find((p) => p.userId === userId);
  if (!player || player.status !== 'active') throw new AppError('You are not an active player', 403);

  // Mark confirmed
  const round = session.currentRound!;
  if (!round.confirmedRolePlayerIds.includes(userId)) {
    round.confirmedRolePlayerIds.push(userId);
  }

  // Also update GamePlayer record
  await GamePlayer.updateOne({ sessionId: session._id, userId }, { hasConfirmedRole: true });

  const activePlayers = session.players.filter((p) => p.status === 'active');
  const allConfirmed = round.confirmedRolePlayerIds.length >= activePlayers.length;

  if (allConfirmed) {
    session.phase = GamePhase.CLUE;
    round.phaseStartedAt = new Date();
    round.phaseEndsAt = null; // Per-turn timeout managed by state machine
    round.currentTurnPlayerId = round.turnOrder[0];
  }

  await session.save();
  return { session, allConfirmed };
}

// ─── Submit Clue ──────────────────────────────────────────────────────────────

export async function submitClue(
  sessionId: string,
  userId: string,
  clue: string
): Promise<{ session: IGameSession; allCluesIn: boolean }> {
  const session = await GameSession.findById(sessionId);
  if (!session) throw new AppError('Game session not found', 404);
  if (session.phase !== GamePhase.CLUE) throw new AppError('Not in clue phase', 400);

  const round = session.currentRound!;
  if (round.currentTurnPlayerId !== userId) throw new AppError('It is not your turn', 403);

  const player = session.players.find((p) => p.userId === userId);
  if (!player) throw new AppError('You are not in this session', 403);
  if (player.status !== 'active') throw new AppError('Eliminated or spectating players cannot submit clues', 403);

  // Check duplicate submission for this turn
  const alreadySubmitted = session.clues.some(
    (c) => c.playerId === userId && c.roundNumber === round.roundNumber && c.cycleNumber === round.cycleNumber
  );
  if (alreadySubmitted) throw new AppError('You have already submitted a clue this cycle', 400);

  // Add clue
  session.clues.push({
    playerId: userId,
    playerName: player.userName,
    clue,
    roundNumber: round.roundNumber,
    cycleNumber: round.cycleNumber,
    submittedAt: new Date(),
  });

  // Advance turn
  const currentTurnIndex = round.turnOrder.indexOf(userId);
  const nextIndex = currentTurnIndex + 1;
  const allCluesIn = nextIndex >= round.turnOrder.length;

  if (!allCluesIn) {
    round.currentTurnPlayerId = round.turnOrder[nextIndex];
  } else {
    // Move to discussion
    session.phase = GamePhase.DISCUSSION;
    round.phaseStartedAt = new Date();
    round.phaseEndsAt = new Date(Date.now() + session.config.discussionTimeSec * 1000);
    round.currentTurnPlayerId = null;
  }

  await session.save();
  return { session, allCluesIn };
}

// ─── Submit Vote ──────────────────────────────────────────────────────────────

export async function submitVote(
  sessionId: string,
  voterId: string,
  targetPlayerId: string
): Promise<IGameSession> {
  const session = await GameSession.findById(sessionId);
  if (!session) throw new AppError('Game session not found', 404);
  if (session.phase !== GamePhase.VOTING) throw new AppError('Not in voting phase', 400);

  const voter = session.players.find((p) => p.userId === voterId);
  if (!voter || voter.status !== 'active') throw new AppError('Only active players can vote', 403);

  const target = session.players.find((p) => p.userId === targetPlayerId);
  if (!target || target.status !== 'active') throw new AppError('Target player is not active', 400);

  if (voterId === targetPlayerId) throw new AppError('You cannot vote for yourself', 400);

  const round = session.currentRound!;

  // Check voting window
  if (round.phaseEndsAt && new Date() > round.phaseEndsAt) {
    throw new AppError('Voting period has ended', 400);
  }

  // Upsert vote (voter can change vote before timer ends)
  await GameVote.findOneAndUpdate(
    { sessionId: session._id, roundNumber: round.roundNumber, cycleNumber: round.cycleNumber, voterId },
    { targetPlayerId, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  return session;
}

// ─── Get My Role ──────────────────────────────────────────────────────────────

export async function getMyRole(
  sessionId: string,
  userId: string
): Promise<PrivateRolePayload> {
  const session = await GameSession.findById(sessionId);
  if (!session) throw new AppError('Game session not found', 404);
  if (session.phase === GamePhase.LOBBY) throw new AppError('Game has not started yet', 400);

  const player = await GamePlayer.findOne({ sessionId: session._id, userId });
  if (!player) throw new AppError('You are not a player in this game', 403);

  const secretWord = player.role === 'normal' ? session.currentRound?.secretWord || null : null;

  return {
    role: player.role,
    secretWord,
  };
}

// ─── Get Public Game State ────────────────────────────────────────────────────

export async function getPublicGameState(sessionId: string): Promise<PublicGameState> {
  const session = await GameSession.findById(sessionId);
  if (!session) throw new AppError('Game session not found', 404);

  const gamePlayerRecords = await GamePlayer.find({ sessionId: session._id }).lean();
  const confirmedSet = new Set(gamePlayerRecords.filter(p => p.hasConfirmedRole).map(p => p.userId));

  const publicPlayers: PublicPlayerState[] = session.players.map((p) => ({
    userId: p.userId,
    userName: p.userName,
    status: p.status,
    isReady: p.isReady,
    isHost: p.isHost,
    hasConfirmedRole: confirmedSet.has(p.userId),
  }));

  let publicRound: PublicRoundState | null = null;
  if (session.currentRound) {
    const r = session.currentRound;
    const activePlayers = session.players.filter((p) => p.status === 'active');
    publicRound = {
      roundNumber: r.roundNumber,
      cycleNumber: r.cycleNumber,
      phaseStartedAt: r.phaseStartedAt,
      phaseEndsAt: r.phaseEndsAt,
      currentTurnPlayerId: r.currentTurnPlayerId,
      turnOrder: r.turnOrder,
      confirmedCount: r.confirmedRolePlayerIds.length,
      totalActiveCount: activePlayers.length,
    };
  }

  let imposterIds: string[] | undefined;
  let imposterNames: string[] | undefined;
  let secretWord: string | null | undefined;
  let finalScores: ScoreEntry[] | undefined;

  if (session.phase === GamePhase.GAME_OVER) {
    const imposters = gamePlayerRecords.filter((p) => p.role === 'imposter');
    imposterIds = imposters.map((p) => p.userId);
    imposterNames = imposters.map((p) => p.userName);
    secretWord = session.currentRound?.secretWord || null;

    const scores = await GameScore.find({ sessionId: session._id }).lean();
    if (scores && scores.length > 0) {
      finalScores = scores.map((s) => ({
        userId: s.userId,
        userName: s.userName,
        points: s.points,
        won: s.won,
        breakdown: s.breakdown,
      }));
    }
  }

  return {
    sessionId: (session._id as any).toString(),
    gameType: session.gameType,
    sessionType: session.sessionType,
    hostUserId: session.hostUserId.toString(),
    status: session.status,
    phase: session.phase,
    config: session.config,
    players: publicPlayers,
    currentRound: publicRound,
    winningSide: session.winningSide,
    createdAt: session.createdAt,
    imposterIds,
    imposterNames,
    secretWord,
    finalScores,
  };
}

// ─── Get Clues for Current Cycle ─────────────────────────────────────────────

export async function getCluesForCycle(
  sessionId: string,
  roundNumber: number,
  cycleNumber: number
): Promise<Array<{ playerId: string; playerName: string; clue: string }>> {
  const session = await GameSession.findById(sessionId).lean();
  if (!session) throw new AppError('Game session not found', 404);

  return (session.clues || [])
    .filter((c) => c.roundNumber === roundNumber && c.cycleNumber === cycleNumber)
    .map((c) => ({ playerId: c.playerId, playerName: c.playerName, clue: c.clue }));
}

// ─── End Game (Host/Admin) ────────────────────────────────────────────────────

export async function endGame(sessionId: string, userId: string): Promise<IGameSession> {
  const session = await GameSession.findById(sessionId);
  if (!session) throw new AppError('Game session not found', 404);
  if (session.hostUserId.toString() !== userId) {
    throw new AppError('Only the host can end the game', 403);
  }
  if (session.status === 'finished' || session.status === 'cancelled') {
    throw new AppError('Game is already over', 400);
  }

  session.status = 'finished';
  session.phase = GamePhase.GAME_OVER;
  session.finishedAt = new Date();
  await session.save();
  return session;
}

// ─── List Active Sessions ─────────────────────────────────────────────────────

export async function listGameSessions(gameType = 'imposter') {
  return GameSession.find({
    gameType,
    status: { $in: ['lobby', 'active'] },
  })
    .select('_id gameType sessionType status phase config players hostUserId createdAt')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
}
