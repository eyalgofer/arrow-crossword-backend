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

// Get progress for all packages
router.get('/progress', authenticateToken, getPackagesProgress);

// Get a specific package
router.get('/:packageId', authenticateToken, getPackage);

export default router;
