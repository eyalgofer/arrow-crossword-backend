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

// Get pending invites (received)
router.get('/pending', authenticateToken, getPendingInvites);

// Get sent invites
router.get('/sent', authenticateToken, getSentInvites);

// Accept an invite
router.post('/:id/accept', authenticateToken, acceptInvite);

// Decline an invite
router.post('/:id/decline', authenticateToken, declineInvite);

// Cancel a sent invite
router.delete('/:id', authenticateToken, cancelInvite);

export default router;
