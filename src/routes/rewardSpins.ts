import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { claimSpin, createSpin, discardSpin } from '../controllers/rewardSpinController';

const router = Router();

router.post('/', authenticateToken, createSpin);
router.post('/:spinId/discard', authenticateToken, discardSpin);
router.post('/:spinId/claim', authenticateToken, claimSpin);

export default router;
