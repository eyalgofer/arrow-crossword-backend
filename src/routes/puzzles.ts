import { Router } from 'express';
import { 
  getPuzzles, 
  getPuzzle, 
  saveProgress, 
  getProgress 
} from '../controllers/puzzleController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken, getPuzzles);
router.get('/:id', authenticateToken, getPuzzle);
router.post('/:puzzleId/progress', authenticateToken, saveProgress);
router.get('/:puzzleId/progress', authenticateToken, getProgress);

export default router;