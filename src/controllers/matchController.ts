import { Response } from 'express';
import mongoose from 'mongoose';
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

export const getActiveMatches = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const matches = await Match.find({
      'players.userId': user._id,
      status: MatchStatus.IN_PROGRESS
    })
      .populate('puzzleId', 'title difficulty')
      .populate('players.userId', 'displayName photoURL')
      .sort({ startedAt: -1 });

    // Enhance matches with opponent info and time elapsed
    const enhancedMatches = matches.map(match => {
      const matchObj = match.toObject();
      
      // Ensure players array includes photoURL (from populated userId or stored value)
      const enhancedPlayers = match.players.map(p => {
        const populatedUser = p.userId as any; // userId is populated
        return {
          userId: populatedUser._id || populatedUser,
          displayName: p.displayName || populatedUser.displayName,
          photoURL: p.photoURL || populatedUser.photoURL,
          progress: p.progress,
          completedAt: p.completedAt
        };
      });

      const opponent = match.players.find(
        p => {
          const playerUserId = (p.userId as any)?._id || p.userId;
          return playerUserId.toString() !== user._id.toString();
        }
      );
      const currentUserPlayer = match.players.find(
        p => {
          const playerUserId = (p.userId as any)?._id || p.userId;
          return playerUserId.toString() === user._id.toString();
        }
      );
      
      const timeElapsed = match.startedAt 
        ? Math.floor((Date.now() - match.startedAt.getTime()) / 1000) // seconds
        : 0;

      // Get opponent photoURL from populated user or stored value
      const opponentUserId = opponent ? ((opponent.userId as any)?._id || opponent.userId) : null;
      const opponentPopulated = opponent ? (opponent.userId as any) : null;

      return {
        ...matchObj,
        players: enhancedPlayers,
        opponent: opponent ? {
          userId: opponentUserId,
          displayName: opponent.displayName || opponentPopulated?.displayName,
          photoURL: opponent.photoURL || opponentPopulated?.photoURL,
          progress: opponent.progress
        } : null,
        currentUserProgress: currentUserPlayer?.progress || 0,
        timeElapsed
      };
    });

    res.json({ matches: enhancedMatches });
  } catch (error) {
    console.error('Get active matches error:', error);
    res.status(500).json({ error: 'Failed to get active matches' });
  }
};

export const getMatch = async (req: AuthRequest, res: Response) => {
  try {
    const { matchId } = req.params;
    console.log('matchId', matchId);
    // Validate matchId
    if (!matchId || matchId === 'undefined' || !mongoose.Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ error: 'Invalid match ID' });
    }

    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const match = await Match.findById(matchId)
      .populate('puzzleId')
      .populate('players.userId', 'displayName photoURL');

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    console.log('user id', user._id);
    console.log('match players', match.players);
    // Verify user is part of this match
    const isPlayer = match.players.some(
      p => p.userId._id.toString() === user._id.toString()
    );

    if (!isPlayer) {
      return res.status(403).json({ error: 'Not authorized to view this match' });
    }

    // Enhance with opponent info and time elapsed
    const opponent = match.players.find(
      p => p.userId.toString() !== user._id.toString()
    );
    const currentUserPlayer = match.players.find(
      p => p.userId.toString() === user._id.toString()
    );
    
    const timeElapsed = match.startedAt 
      ? Math.floor((Date.now() - match.startedAt.getTime()) / 1000) // seconds
      : 0;

    const enhancedMatch = {
      ...match.toObject(),
      opponent: opponent ? {
        userId: opponent.userId,
        displayName: opponent.displayName,
        photoURL: opponent.photoURL,
        progress: opponent.progress
      } : null,
      currentUserProgress: currentUserPlayer?.progress || 0,
      timeElapsed
    };

    res.json({ match: enhancedMatch });
  } catch (error) {
    console.error('Get match error:', error);
    res.status(500).json({ error: 'Failed to get match' });
  }
};