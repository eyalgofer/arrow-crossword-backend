import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  claimRewardSpin,
  createRewardSpin,
  discardRewardSpin,
} from '../services/rewardSpins';

export const createSpin = async (req: AuthRequest, res: Response) => {
  try {
    const result = await createRewardSpin(req.user!.uid);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Create reward spin error:', error);
    res.status(500).json({ error: 'Failed to create reward spin' });
  }
};

export const discardSpin = async (req: AuthRequest, res: Response) => {
  try {
    const result = await discardRewardSpin(req.user!.uid, req.params.spinId);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Discard reward spin error:', error);
    res.status(500).json({ error: 'Failed to discard reward spin' });
  }
};

export const claimSpin = async (req: AuthRequest, res: Response) => {
  try {
    const result = await claimRewardSpin(req.user!.uid, req.params.spinId);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Claim reward spin error:', error);
    res.status(500).json({ error: 'Failed to claim reward spin' });
  }
};
