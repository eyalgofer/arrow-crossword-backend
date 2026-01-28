import { Router } from 'express';
import { getMatchHistory, getActiveMatches, getMatch, leaveMatch } from '../controllers/matchController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/history', authenticateToken, getMatchHistory);
router.get('/active', authenticateToken, getActiveMatches);
router.post('/:matchId/leave', authenticateToken, leaveMatch);
router.get('/:matchId', authenticateToken, getMatch);

export default router;