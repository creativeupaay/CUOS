import { Router } from 'express';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import {
  listSessions,
  createSession,
  getSession,
  joinSession,
  leaveSession,
  readyUp,
  updateConfig,
  startGameSession,
  getMyRoleHandler,
  confirmRoleHandler,
  submitClueHandler,
  submitVoteHandler,
  getClues,
  endGameHandler,
} from '../controllers/game.controller';
import { getLeaderboardHandler, getMyStatsHandler } from '../controllers/leaderboard.controller';

const router = Router();

// All game-zone routes require authentication
router.use(authenticate);

// ─── Sessions ──────────────────────────────────────────────────────────────
router.get('/sessions', listSessions);
router.post('/sessions', createSession);

router.get('/sessions/:sessionId', getSession);
router.post('/sessions/:sessionId/join', joinSession);
router.post('/sessions/:sessionId/leave', leaveSession);
router.patch('/sessions/:sessionId/config', updateConfig);
router.post('/sessions/:sessionId/ready', readyUp);
router.post('/sessions/:sessionId/start', startGameSession);
router.post('/sessions/:sessionId/end', endGameHandler);

// ─── Role (private — per-player only) ─────────────────────────────────────
router.get('/sessions/:sessionId/my-role', getMyRoleHandler);
router.post('/sessions/:sessionId/confirm-role', confirmRoleHandler);

// ─── Gameplay ──────────────────────────────────────────────────────────────
router.post('/sessions/:sessionId/clue', submitClueHandler);
router.post('/sessions/:sessionId/vote', submitVoteHandler);
router.get('/sessions/:sessionId/clues', getClues);

// ─── Leaderboard ───────────────────────────────────────────────────────────
router.get('/leaderboard', getLeaderboardHandler);
router.get('/leaderboard/me', getMyStatsHandler);

export default router;
