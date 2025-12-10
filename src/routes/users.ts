import { Router } from 'express';
import { updateProfile, getLeaderboard, getUserStats } from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.put('/profile', authenticate, updateProfile);
router.get('/leaderboard', authenticate, getLeaderboard);
router.get('/stats', authenticate, getUserStats);

export default router;