import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  cancelLobby,
  claimLobbyBoost,
  createLobby,
  createLobbyBoost,
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
router.post('/:id/boosts', authenticateToken, createLobbyBoost);
router.post('/:id/boosts/:boostId/claim', authenticateToken, claimLobbyBoost);

export default router;
