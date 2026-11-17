import { Router } from 'express';
import {
  getFiveLetterCard,
  getFiveLetterSolvedCount,
  getFiveLetterToday,
  postFiveLetterElapsed,
  postFiveLetterGuess,
} from '../controllers/fiveLetterController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/five/card', authenticateToken, getFiveLetterCard);
router.get('/five/solved-count', authenticateToken, getFiveLetterSolvedCount);
router.get('/five/today', authenticateToken, getFiveLetterToday);
router.post('/five/guess', authenticateToken, postFiveLetterGuess);
router.post('/five/elapsed', authenticateToken, postFiveLetterElapsed);

export default router;
