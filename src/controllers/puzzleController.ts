import { Response } from 'express';
import { Puzzle } from '../models/Puzzle';
import { UserPuzzleProgress, IProgressCell } from '../models/UserPuzzleProgress';
import { User } from '../models/User';
import { AuthRequest, ProgressSummary } from '../types';

export const getPuzzles = async (req: AuthRequest, res: Response) => {
  try {
    const { difficulty, category, limit = 30 } = req.query;

    // Query for puzzles where isActive is not false (handles true, undefined, and null)
    const query: any = { isActive: { $ne: false } };
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

export const getDailyPuzzle = async (req: AuthRequest, res: Response) => {
  try {
    // For now, return the same puzzle every day
    // Later this will be changed to return different puzzles per day
    const puzzle = await Puzzle.findOne({ isActive: { $ne: false } })
      .select('-clues.across.answer -clues.down.answer')
      .sort({ createdAt: 1 });

    if (!puzzle) {
      return res.status(404).json({ error: 'No daily puzzle available' });
    }

    const puzzleData = {
      ...puzzle.toObject(),
      clues: puzzle.clues,
    };

    res.json({ puzzle: puzzleData });
  } catch (error) {
    console.error('Get daily puzzle error:', error);
    res.status(500).json({ error: 'Failed to get daily puzzle' });
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

/**
 * POST /api/puzzles/:puzzleId/progress
 * Save or update the user's progress on a specific puzzle (upsert)
 */
export const saveProgress = async (req: AuthRequest, res: Response) => {
  try {
    const { puzzleId } = req.params;
    const { cells, completedCluesCount, totalClues, isCompleted, elapsedTime, bestTime } = req.body;

    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify the puzzle exists
    const puzzle = await Puzzle.findById(puzzleId);
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found' });
    }

    const now = new Date();

    let progress = await UserPuzzleProgress.findOne({
      userId: user._id,
      puzzleId
    });

    if (progress) {
      // Update existing progress
      progress.cells = cells as IProgressCell[];
      progress.completedCluesCount = completedCluesCount;
      progress.totalClues = totalClues;
      progress.isCompleted = isCompleted;
      progress.elapsedTime = elapsedTime;
      progress.lastPlayedAt = now;
      
      // Only update bestTime if provided and better than existing
      if (bestTime !== undefined && bestTime !== null) {
        if (progress.bestTime === null || bestTime < progress.bestTime) {
          progress.bestTime = bestTime;
        }
      }

      await progress.save();
    } else {
      // Create new progress
      progress = new UserPuzzleProgress({
        userId: user._id,
        puzzleId,
        cells: cells as IProgressCell[],
        completedCluesCount,
        totalClues,
        isCompleted,
        elapsedTime,
        bestTime: bestTime ?? null,
        lastPlayedAt: now
      });
      await progress.save();
    }

    res.json({
      success: true,
      progress: {
        puzzleId: progress.puzzleId,
        cells: progress.cells,
        completedCluesCount: progress.completedCluesCount,
        totalClues: progress.totalClues,
        isCompleted: progress.isCompleted,
        lastPlayedAt: progress.lastPlayedAt,
        elapsedTime: progress.elapsedTime,
        bestTime: progress.bestTime
      }
    });
  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({ error: 'Failed to save progress' });
  }
};

/**
 * GET /api/puzzles/:puzzleId/progress
 * Get the user's progress on a specific puzzle
 */
export const getProgress = async (req: AuthRequest, res: Response) => {
  try {
    const { puzzleId } = req.params;

    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify the puzzle exists
    const puzzle = await Puzzle.findById(puzzleId);
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found' });
    }

    const progress = await UserPuzzleProgress.findOne({
      userId: user._id,
      puzzleId
    });

    if (!progress) {
      return res.json({ progress: null });
    }

    res.json({
      progress: {
        puzzleId: progress.puzzleId,
        cells: progress.cells,
        completedCluesCount: progress.completedCluesCount,
        totalClues: progress.totalClues,
        isCompleted: progress.isCompleted,
        lastPlayedAt: progress.lastPlayedAt,
        elapsedTime: progress.elapsedTime,
        bestTime: progress.bestTime
      }
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
};

/**
 * GET /api/puzzles/progress
 * Get progress summaries for all puzzles the user has played
 */
export const getAllProgress = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const progressList = await UserPuzzleProgress.find({ userId: user._id });

    const summaries: ProgressSummary[] = progressList.map((p) => {
      const progressPercent = p.totalClues > 0 
        ? Math.round((p.completedCluesCount / p.totalClues) * 100) 
        : 0;
      
      return {
        puzzleId: p.puzzleId.toString(),
        progress: progressPercent,
        isCompleted: p.isCompleted,
        isInProgress: progressPercent > 0 && !p.isCompleted,
        bestTime: p.bestTime,
        lastPlayedAt: p.lastPlayedAt
      };
    });

    res.json({ progress: summaries });
  } catch (error) {
    console.error('Get all progress error:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
};

/**
 * POST /api/puzzles/:puzzleId/complete
 * Mark a puzzle as completed with the final time
 */
export const completePuzzle = async (req: AuthRequest, res: Response) => {
  try {
    const { puzzleId } = req.params;
    const { completionTime } = req.body;

    if (typeof completionTime !== 'number' || completionTime < 0) {
      return res.status(400).json({ error: 'Invalid completion time' });
    }

    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const puzzle = await Puzzle.findById(puzzleId);
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found' });
    }

    let progress = await UserPuzzleProgress.findOne({
      userId: user._id,
      puzzleId
    });

    const wasAlreadyCompleted = progress?.isCompleted ?? false;
    let coinsAwarded = 0;

    if (progress) {
      // Update existing progress
      const shouldUpdateBestTime = progress.bestTime === null || completionTime < progress.bestTime;
      
      if (shouldUpdateBestTime) {
        progress.bestTime = completionTime;
      }

      if (!progress.isCompleted) {
        progress.isCompleted = true;
        progress.completedCluesCount = progress.totalClues;
        
        // Award coins only on first completion
        coinsAwarded = puzzle.coinReward;
        user.coins += coinsAwarded;
        user.stats.totalGames += 1;
        user.stats.totalTime += completionTime;
        user.stats.averageTime = user.stats.totalTime / user.stats.totalGames;
        
        if (user.stats.fastestTime === 0 || completionTime < user.stats.fastestTime) {
          user.stats.fastestTime = completionTime;
        }

        await user.save();
      }

      progress.lastPlayedAt = new Date();
      await progress.save();
    } else {
      // Create new progress as completed
      progress = new UserPuzzleProgress({
        userId: user._id,
        puzzleId,
        cells: [],
        completedCluesCount: puzzle.clues.length,
        totalClues: puzzle.clues.length,
        isCompleted: true,
        elapsedTime: completionTime,
        bestTime: completionTime,
        lastPlayedAt: new Date()
      });
      await progress.save();

      // Award coins for first completion
      coinsAwarded = puzzle.coinReward;
      user.coins += coinsAwarded;
      user.stats.totalGames += 1;
      user.stats.totalTime += completionTime;
      user.stats.averageTime = user.stats.totalTime / user.stats.totalGames;
      
      if (user.stats.fastestTime === 0 || completionTime < user.stats.fastestTime) {
        user.stats.fastestTime = completionTime;
      }

      await user.save();
    }

    res.json({
      success: true,
      progress: {
        puzzleId: progress.puzzleId,
        isCompleted: progress.isCompleted,
        bestTime: progress.bestTime,
        completionTime
      },
      coinsAwarded
    });
  } catch (error) {
    console.error('Complete puzzle error:', error);
    res.status(500).json({ error: 'Failed to complete puzzle' });
  }
};

/**
 * DELETE /api/puzzles/:puzzleId/progress
 * Delete progress for a specific puzzle (reset functionality)
 */
export const deleteProgress = async (req: AuthRequest, res: Response) => {
  try {
    const { puzzleId } = req.params;

    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify the puzzle exists
    const puzzle = await Puzzle.findById(puzzleId);
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found' });
    }

    await UserPuzzleProgress.deleteOne({
      userId: user._id,
      puzzleId
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete progress error:', error);
    res.status(500).json({ error: 'Failed to delete progress' });
  }
};