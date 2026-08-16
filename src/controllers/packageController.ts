import { Response } from 'express';
import mongoose from 'mongoose';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { User } from '../models/User';
import { AuthRequest } from '../types';
import { resolveLanguage, languageFilter } from '../utils/language';

/**
 * GET /api/packages
 * Returns all puzzle packages ordered by their display order
 */
export const getPackages = async (req: AuthRequest, res: Response) => {
  try {
    // Log connection details for debugging
    const db = mongoose.connection.db;
    const dbName = (db as any)?.databaseName || mongoose.connection.name || 'UNKNOWN';
    const collectionName = PuzzlePackage.collection.name;
    const connectionState = mongoose.connection.readyState; // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    
    console.log(`🔍 Querying packages:`);
    console.log(`   Connection state: ${connectionState} (0=disconnected, 1=connected)`);
    console.log(`   Database: ${dbName}`);
    console.log(`   Collection: ${collectionName}`);
    console.log(`   Model name: ${PuzzlePackage.modelName}`);
    console.log(`   Connection host: ${mongoose.connection.host || 'unknown'}`);

    // Check total count first for debugging
    const totalCount = await PuzzlePackage.countDocuments();
    console.log(`📦 Total packages in database: ${totalCount}`);

    // Also try raw collection query to see if documents exist
    const rawCount = await PuzzlePackage.collection.countDocuments();
    console.log(`📦 Raw collection count: ${rawCount}`);

    // Try listing all collections to see what's available
    if (mongoose.connection.db) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log(`📚 Available collections: ${collections.map(c => c.name).join(', ')}`);
    }

    // Israeli users get Hebrew packages (names, themes, and puzzles in Hebrew)
    const packages = await PuzzlePackage.find({ language: languageFilter(resolveLanguage(req)) })
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

    // Get all packages in the user's language ordered by display order
    const packages = await PuzzlePackage.find({ language: languageFilter(resolveLanguage(req)) })
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
