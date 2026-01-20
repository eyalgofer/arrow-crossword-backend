import { Response } from 'express';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { User } from '../models/User';
import { AuthRequest } from '../types';

/**
 * GET /api/packages
 * Returns all puzzle packages ordered by their display order
 */
export const getPackages = async (req: AuthRequest, res: Response) => {
  try {
    const packages = await PuzzlePackage.find()
      .sort({ order: 1 })
      .lean();

    res.json({ packages });
  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({ error: 'Failed to get packages' });
  }
};

/**
 * GET /api/packages/progress
 * Returns progress for all packages for the authenticated user
 */
export const getPackagesProgress = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all packages ordered by display order
    const packages = await PuzzlePackage.find()
      .sort({ order: 1 })
      .lean();

    // Get all completed puzzle IDs for this user
    const completedProgress = await UserPuzzleProgress.find({
      userId: user._id,
      isCompleted: true
    }).select('puzzleId').lean();

    const completedPuzzleIds = new Set(
      completedProgress.map(p => p.puzzleId.toString())
    );

    // Calculate progress for each package
    const progress = packages.map(pkg => {
      const completedCount = pkg.puzzleIds.filter(
        puzzleId => completedPuzzleIds.has(puzzleId.toString())
      ).length;

      return {
        packageId: pkg._id,
        completedCount,
        isCompleted: completedCount >= pkg.puzzleCount
      };
    });

    // Calculate total completed puzzles across all packages
    const totalCompletedPuzzles = progress.reduce(
      (sum, p) => sum + p.completedCount,
      0
    );

    res.json({
      progress,
      totalCompletedPuzzles
    });
  } catch (error) {
    console.error('Get packages progress error:', error);
    res.status(500).json({ error: 'Failed to get packages progress' });
  }
};

/**
 * GET /api/packages/:packageId
 * Returns detailed information about a specific package
 */
export const getPackage = async (req: AuthRequest, res: Response) => {
  try {
    const { packageId } = req.params;

    const puzzlePackage = await PuzzlePackage.findById(packageId).lean();

    if (!puzzlePackage) {
      return res.status(404).json({ error: 'Package not found' });
    }

    res.json({ package: puzzlePackage });
  } catch (error) {
    console.error('Get package error:', error);
    res.status(500).json({ error: 'Failed to get package' });
  }
};
