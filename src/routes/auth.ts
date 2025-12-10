import { Router } from 'express';
import { register, getProfile } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', authenticate, register);
router.get('/profile', authenticate, getProfile);

export default router;