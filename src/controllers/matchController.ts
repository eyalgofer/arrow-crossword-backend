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
      const opponent = match.players.find(
        p => p.userId.toString() !== user._id.toString()
      );
      const currentUserPlayer = match.players.find(
        p => p.userId.toString() === user._id.toString()
      );
      
      const timeElapsed = match.startedAt 
        ? Math.floor((Date.now() - match.startedAt.getTime()) / 1000) // seconds
        : 0;

      return {
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