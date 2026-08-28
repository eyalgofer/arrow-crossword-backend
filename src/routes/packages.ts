import { Router } from 'express';
import {
  getPackages,
  getPackagesProgress,
  getPackage
} from '../controllers/packageController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', getPackages);
router.get('/progress', authenticateToken, getPackagesProgress);
router.get('/:packageId', getPackage);

export default router;
