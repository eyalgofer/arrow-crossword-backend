import { Response } from 'express';
import { User } from '../models/User';
import { AuthRequest } from '../types';

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, photoURL, preferences } = req.body;

    const user = await User.findOneAndUpdate(
      { firebaseUid: req.user!.uid },
      { 
        ...(displayName && { displayName }),
        ...(photoURL && { photoURL }),
        ...(preferences && { preferences })
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const getLeaderboard = async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    
    const leaderboard = await User.find()
      .select('displayName level xp stats photoURL')
      .sort({ level: -1, xp: -1 })
      .limit(limit);

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
};

export const getUserStats = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid })
      .select('stats level xp');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ stats: user.stats, level: user.level, xp: user.xp });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
};