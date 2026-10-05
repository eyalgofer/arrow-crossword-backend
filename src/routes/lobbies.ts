import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  cancelLobby,
  createLobby,
  getActiveLobby,
  respondToLobby,
  startLobby
} from '../controllers/lobbyController';

const router = Router();

router.post('/', authenticateToken, createLobby);
router.get('/active', authenticateToken, getActiveLobby);
router.post('/:id/respond', authenticateToken, respondToLobby);
router.post('/:id/start', authenticateToken, startLobby);
router.post('/:id/cancel', authenticateToken, cancelLobby);

export default router;
