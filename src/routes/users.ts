import { Router } from 'express';
import { updateProfile, getCoins, addCoins, spendCoins, searchByEmail, getReferralInfo } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/search', authenticateToken, searchByEmail);
router.put('/profile', authenticateToken, updateProfile);
router.get('/coins', authenticateToken, getCoins);
router.post('/coins/add', authenticateToken, addCoins);
router.post('/coins/spend', authenticateToken, spendCoins);
router.get('/referral', authenticateToken, getReferralInfo);

export default router;