import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { claimMatchmakingBoost, createMatchmakingBoost } from '../controllers/matchmakingController';

const router = Router();

router.post('/boosts', authenticateToken, createMatchmakingBoost);
router.post('/boosts/:boostId/claim', authenticateToken, claimMatchmakingBoost);

export default router;
