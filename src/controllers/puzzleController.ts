import { Response } from 'express';
import { Puzzle } from '../models/Puzzle';
import { UserProgress } from '../models/UserProgress';
import { User } from '../models/User';
import { AuthRequest } from '../types';

export const getPuzzles = async (req: AuthRequest, res: Response) => {
  try {
    const { difficulty, category, limit = 20 } = req.query;

    const query: any = { isActive: true };
    if (difficulty) query.difficulty = difficulty;
    if (category) query.category = category;

    const puzzles = await Puzzle.find(query)
      .select('-clues.across.answer -clues.down.answer')
      .limit(parseInt(limit as string));

    res.json({ puzzles });
  } catch (error) {
    console.error('Get puzzles error:', error);
    res.status(500).json({ error: 'Failed to get puzzles' });
  }
};

export const getPuzzle = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const puzzle = await Puzzle.findById(id);

    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found' });
    }

    const puzzleData = {
      ...puzzle.toObject(),
      clues: puzzle.clues,
    };

    res.json({ puzzle: puzzleData });
  } catch (error) {
    console.error('Get puzzle error:', error);
    res.status(500).json({ error: 'Failed to get puzzle' });
  }
};

export const saveProgress = async (req: AuthRequest, res: Response) => {
  try {
    const { puzzleId, state, timeSpent, correctCells, totalCells, completed } = req.body;

    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let progress = await UserProgress.findOne({
      userId: user._id,
      puzzleId
    });

    if (progress) {
      progress.state = state;
      progress.timeSpent = timeSpent;
      progress.correctCells = correctCells;
      progress.lastPlayedAt = new Date();
      
      if (completed && !progress.completed) {
        progress.completed = true;
        progress.completedAt = new Date();

        const puzzle = await Puzzle.findById(puzzleId);
        if (puzzle) {
          user.stats.totalGames += 1;
          user.coins += puzzle.coinReward;
          user.stats.totalTime += timeSpent;
          user.stats.averageTime = user.stats.totalTime / user.stats.totalGames;
          
          if (user.stats.fastestTime === 0 || timeSpent < user.stats.fastestTime) {
            user.stats.fastestTime = timeSpent;
          }

          await user.save();
        }
      }

      await progress.save();
    } else {
      progress = new UserProgress({
        userId: user._id,
        puzzleId,
        state,
        timeSpent,
        correctCells,
        totalCells,
        completed,
        completedAt: completed ? new Date() : undefined
      });
      await progress.save();
    }

    res.json({ progress });
  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({ error: 'Failed to save progress' });
  }
};

export const getProgress = async (req: AuthRequest, res: Response) => {
  try {
    const { puzzleId } = req.params;

    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const progress = await UserProgress.findOne({
      userId: user._id,
      puzzleId
    });

    res.json({ progress });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
};