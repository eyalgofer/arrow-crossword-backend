import { Router } from 'express';
import { 
  getPuzzles, 
  getPuzzle, 
  getDailyPuzzle,
  saveProgress, 
  getProgress,
  getAllProgress,
  completePuzzle,
  deleteProgress
} from '../controllers/puzzleController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Puzzle listing endpoints
router.get('/', authenticateToken, getPuzzles);
router.get('/daily', authenticateToken, getDailyPuzzle);

// Progress summary endpoint (must be before /:id to avoid conflict)
router.get('/progress', authenticateToken, getAllProgress);

// Single puzzle endpoint
router.get('/:id', authenticateToken, getPuzzle);

// Progress endpoints for specific puzzle
router.post('/:puzzleId/progress', authenticateToken, saveProgress);
router.get('/:puzzleId/progress', authenticateToken, getProgress);
router.delete('/:puzzleId/progress', authenticateToken, deleteProgress);

// Completion endpoint
router.post('/:puzzleId/complete', authenticateToken, completePuzzle);

export default router;