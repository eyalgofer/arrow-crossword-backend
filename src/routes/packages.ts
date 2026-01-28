import { Router } from 'express';
import {
  getPackages,
  getPackagesProgress,
  getPackage
} from '../controllers/packageController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get all packages
router.get('/', authenticateToken, getPackages);
router.get('/progress', authenticateToken, getPackagesProgress);
router.get('/:packageId', authenticateToken, getPackage);

export default router;
