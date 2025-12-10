import { Router } from 'express';
import { 
  getPuzzles, 
  getPuzzle, 
  saveProgress, 
  getProgress 
} from '../controllers/puzzleController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getPuzzles);
router.get('/:id', authenticate, getPuzzle);
router.post('/:puzzleId/progress', authenticate, saveProgress);
router.get('/:puzzleId/progress', authenticate, getProgress);

export default router;