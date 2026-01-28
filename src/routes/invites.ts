import { Router } from 'express';
import { 
  createInvite, 
  getPendingInvites, 
  getSentInvites,
  acceptInvite, 
  declineInvite,
  cancelInvite 
} from '../controllers/inviteController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Create a new invite
router.post('/', authenticateToken, createInvite);
router.get('/pending', authenticateToken, getPendingInvites);
router.get('/sent', authenticateToken, getSentInvites);
router.post('/:id/accept', authenticateToken, acceptInvite);
router.post('/:id/decline', authenticateToken, declineInvite);
router.post('/:id/cancel', authenticateToken, cancelInvite);

export default router;
