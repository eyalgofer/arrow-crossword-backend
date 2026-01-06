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
      .select('displayName coins stats photoURL')
      .sort({ coins: -1 })
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
      .select('stats coins');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ stats: user.stats, coins: user.coins });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
};

export const getCoins = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid })
      .select('coins');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ coins: user.coins });
  } catch (error) {
    console.error('Get coins error:', error);
    res.status(500).json({ error: 'Failed to get coins' });
  }
};

export const addCoins = async (req: AuthRequest, res: Response) => {
  try {
    const { amount } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid: req.user!.uid },
      { $inc: { coins: amount } },
      { new: true }
    ).select('coins');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ coins: user.coins });
  } catch (error) {
    console.error('Add coins error:', error);
    res.status(500).json({ error: 'Failed to add coins' });
  }
};

export const spendCoins = async (req: AuthRequest, res: Response) => {
  try {
    const { amount } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const user = await User.findOne({ firebaseUid: req.user!.uid });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.coins < amount) {
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    user.coins -= amount;
    await user.save();

    res.json({ coins: user.coins });
  } catch (error) {
    console.error('Spend coins error:', error);
    res.status(500).json({ error: 'Failed to spend coins' });
  }
};

export const searchByEmail = async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email query parameter is required' });
    }

    // Get the current user to exclude from search results
    const currentUser = await User.findOne({ firebaseUid: req.user!.uid });

    // Search for users by email (case-insensitive partial match)
    const users = await User.find({
      email: { $regex: email, $options: 'i' },
      ...(currentUser && { _id: { $ne: currentUser._id } }) // Exclude current user
    })
      .select('_id displayName email photoURL')
      .limit(10);

    res.json({ users });
  } catch (error) {
    console.error('Search by email error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
};