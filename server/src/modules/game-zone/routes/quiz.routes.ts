import { Router } from 'express';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import {
  listQuizSessionsHandler,
  createQuizSessionHandler,
  getQuizSessionHandler,
  getQuizPreparationHandler,
  joinQuizSessionHandler,
  leaveQuizSessionHandler,
  readyQuizHandler,
  startQuizGameHandler,
  endQuizGameHandler,
} from '../controllers/quiz.controller';

const router = Router();

// All Quiz routes require authentication
router.use(authenticate);

// ─── Sessions ────────────────────────────────────────────────────────────────
router.get('/sessions', listQuizSessionsHandler);
router.post('/sessions', createQuizSessionHandler);

router.get('/sessions/:sessionId', getQuizSessionHandler);
router.get('/sessions/:sessionId/preparation', getQuizPreparationHandler);
router.post('/sessions/:sessionId/join', joinQuizSessionHandler);
router.post('/sessions/:sessionId/leave', leaveQuizSessionHandler);
router.post('/sessions/:sessionId/ready', readyQuizHandler);
router.post('/sessions/:sessionId/start', startQuizGameHandler);
router.post('/sessions/:sessionId/end', endQuizGameHandler);

export default router;
