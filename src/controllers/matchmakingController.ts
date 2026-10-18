import { Response } from 'express';
import { User } from '../models/User';
import { AuthRequest } from '../types';
import { claimQueueBoost, createQueueBoost } from '../services/matchmakingHold';

export const createMatchmakingBoost = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await createQueueBoost(user._id.toString());
    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }
    return res.json({ boostId: result.boostId, amount: result.amount });
  } catch (error) {
    console.error('Create matchmaking boost error:', error);
    return res.status(500).json({ error: 'Failed to create boost' });
  }
};

export const claimMatchmakingBoost = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await claimQueueBoost(user._id.toString(), req.params.boostId);
    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }
    return res.json({ pot: result.pot });
  } catch (error) {
    console.error('Claim matchmaking boost error:', error);
    return res.status(500).json({ error: 'Failed to claim boost' });
  }
};
