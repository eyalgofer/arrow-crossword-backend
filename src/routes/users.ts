import { Router } from 'express';
import { updateProfile, getLeaderboard, getUserStats } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.put('/profile', authenticateToken, updateProfile);
router.get('/leaderboard', authenticateToken, getLeaderboard);
router.get('/stats', authenticateToken, getUserStats);

export default router;