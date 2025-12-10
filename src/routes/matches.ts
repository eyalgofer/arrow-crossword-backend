import { Router } from 'express';
import { getMatchHistory, getMatch } from '../controllers/matchController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/history', authenticate, getMatchHistory);
router.get('/:matchId', authenticate, getMatch);

export default router;