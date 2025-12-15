import { Router } from 'express';
import { getMatchHistory, getMatch } from '../controllers/matchController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/history', authenticateToken, getMatchHistory);
router.get('/:matchId', authenticateToken, getMatch);

export default router;