import { Router } from 'express';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import {
  listWordleSessionsHandler,
  createWordleSessionHandler,
  getWordleSessionHandler,
  joinWordleSessionHandler,
  leaveWordleSessionHandler,
  readyWordleHandler,
  startWordleGameHandler,
  submitWordleGuessHandler,
  getMyWordleGuessesHandler,
  endWordleGameHandler,
} from '../controllers/wordle.controller';

const router = Router();

// All Wordle routes require authentication
router.use(authenticate);

// ─── Sessions ─────────────────────────────────────────────────────────────
router.get('/sessions', listWordleSessionsHandler);
router.post('/sessions', createWordleSessionHandler);

router.get('/sessions/:sessionId', getWordleSessionHandler);
router.post('/sessions/:sessionId/join', joinWordleSessionHandler);
router.post('/sessions/:sessionId/leave', leaveWordleSessionHandler);
router.post('/sessions/:sessionId/ready', readyWordleHandler);
router.post('/sessions/:sessionId/start', startWordleGameHandler);
router.post('/sessions/:sessionId/end', endWordleGameHandler);

// ─── Gameplay ─────────────────────────────────────────────────────────────
router.post('/sessions/:sessionId/guess', submitWordleGuessHandler);
router.get('/sessions/:sessionId/my-guesses', getMyWordleGuessesHandler);

export default router;
