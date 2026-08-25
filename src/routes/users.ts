import { Router } from 'express';
import { updateProfile, getCoins, addCoins, spendCoins, searchByNameOrEmail, getReferralInfo, checkDisplayNameAvailable, setDisplayName } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/displayName/available', authenticateToken, checkDisplayNameAvailable);
router.put('/displayName', authenticateToken, setDisplayName);
router.get('/search', authenticateToken, searchByNameOrEmail);
router.put('/profile', authenticateToken, updateProfile);
router.get('/coins', authenticateToken, getCoins);
router.post('/coins/add', authenticateToken, addCoins);
router.post('/coins/spend', authenticateToken, spendCoins);
router.get('/referral', authenticateToken, getReferralInfo);

export default router;