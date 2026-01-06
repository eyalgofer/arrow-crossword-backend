import { Router } from 'express';
import { updateProfile, getLeaderboard, getUserStats, getCoins, addCoins, spendCoins, searchByEmail } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/search', authenticateToken, searchByEmail);
router.put('/profile', authenticateToken, updateProfile);
router.get('/leaderboard', authenticateToken, getLeaderboard);
router.get('/stats', authenticateToken, getUserStats);
router.get('/coins', authenticateToken, getCoins);
router.post('/coins/add', authenticateToken, addCoins);
router.post('/coins/spend', authenticateToken, spendCoins);

export default router;