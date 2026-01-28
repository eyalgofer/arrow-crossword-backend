import { Router } from 'express';
import { 
  getPuzzles, 
  getPuzzle, 
  getDailyPuzzle,
  getRandomPuzzle,
  saveProgress, 
  getProgress,
  getAllProgress,
  completePuzzle,
  deleteProgress
} from '../controllers/puzzleController';
import { authenticateToken } from '../middleware/auth';

const router = Router();


router.get('/', authenticateToken, getPuzzles);
router.get('/daily', authenticateToken, getDailyPuzzle);
router.get('/random', authenticateToken, getRandomPuzzle); 
router.get('/progress', authenticateToken, getAllProgress);
router.get('/:id', authenticateToken, getPuzzle);

router.post('/:puzzleId/progress', authenticateToken, saveProgress);
router.get('/:puzzleId/progress', authenticateToken, getProgress);
router.delete('/:puzzleId/progress', authenticateToken, deleteProgress);

router.post('/:puzzleId/complete', authenticateToken, completePuzzle);

export default router;