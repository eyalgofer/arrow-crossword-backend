import { Router } from 'express';
import {
  getFiveLetterCard,
  getFiveLetterSolvedCount,
  getFiveLetterToday,
  postFiveLetterElapsed,
  postFiveLetterGuess,
} from '../controllers/fiveLetterController';
import { getHiveCard, getHiveToday, postHiveElapsed, postHiveGuess } from '../controllers/hiveController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/five/card', authenticateToken, getFiveLetterCard);
router.get('/five/solved-count', authenticateToken, getFiveLetterSolvedCount);
router.get('/five/today', authenticateToken, getFiveLetterToday);
router.post('/five/guess', authenticateToken, postFiveLetterGuess);
router.post('/five/elapsed', authenticateToken, postFiveLetterElapsed);

router.get('/hive/card', authenticateToken, getHiveCard);
router.get('/hive/today', authenticateToken, getHiveToday);
router.post('/hive/guess', authenticateToken, postHiveGuess);
router.post('/hive/elapsed', authenticateToken, postHiveElapsed);

export default router;
