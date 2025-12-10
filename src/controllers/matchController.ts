import { Response } from 'express';
import { Match } from '../models/Match';
import { User } from '../models/User';
import { AuthRequest } from '../types';
import { MatchStatus } from '../types';

export const getMatchHistory = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const limit = parseInt(req.query.limit as string) || 20;

    const matches = await Match.find({
      'players.userId': user._id,
      status: MatchStatus.COMPLETED
    })
      .populate('puzzleId', 'title difficulty')
      .sort({ completedAt: -1 })
      .limit(limit);

    res.json({ matches });
  } catch (error) {
    console.error('Get match history error:', error);
    res.status(500).json({ error: 'Failed to get match history' });
  }
};

export const getMatch = async (req: AuthRequest, res: Response) => {
  try {
    const { matchId } = req.params;

    const match = await Match.findById(matchId)
      .populate('puzzleId')
      .populate('players.userId', 'displayName photoURL');

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ match });
  } catch (error) {
    console.error('Get match error:', error);
    res.status(500).json({ error: 'Failed to get match' });
  }
};