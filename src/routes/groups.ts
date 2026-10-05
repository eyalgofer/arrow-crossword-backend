import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { createGroup, deleteGroup, listGroups, updateGroup } from '../controllers/groupController';

const router = Router();

router.post('/', authenticateToken, createGroup);
router.get('/', authenticateToken, listGroups);
router.patch('/:id', authenticateToken, updateGroup);
router.delete('/:id', authenticateToken, deleteGroup);

export default router;
