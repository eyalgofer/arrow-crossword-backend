import { Response } from 'express';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { User } from '../models/User';
import { AuthRequest } from '../types';
import { firstPackageHeadStart } from '../services/starterClues';
import {
  attachOpenerClueIds,
  buildPackageProgress,
  catalogEtagSource,
  loadRingDifficulties,
  progressEtagSource,
  withRingDifficulties,
} from '../services/packageCatalog';
import { sendCachedJson } from '../utils/conditionalGet';
import { resolveLanguage, languageFilter } from '../utils/language';
import { toIdString } from '../utils/objectId';

/**
 * GET /api/packages
 * Returns all puzzle packages ordered by their display order
 */
export const getPackages = async (req: AuthRequest, res: Response) => {
  try {
    // Israeli users get Hebrew packages (names, themes, and puzzles in Hebrew).
    // he, en, and he-en are separate catalogs.
    const language = resolveLanguage(req);
    const packages = await PuzzlePackage.find({ language: languageFilter(language) })
      .sort({ order: 1 })
      .lean();

    const difficultyById = await loadRingDifficulties(
      packages.flatMap(pkg => pkg.puzzleIds ?? [])
    );

    // No If-None-Match: 200 and the package fields already in production, plus
    // optional ring difficulty. A matching validator skips that body.
    sendCachedJson(req, res, catalogEtagSource(language, packages, difficultyById), () => ({
      packages: withRingDifficulties(packages, difficultyById),
    }));
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
    const language = resolveLanguage(req);
    const [packages, headStart] = await Promise.all([
      PuzzlePackage.find({ language: languageFilter(language) })
        .select('_id puzzleIds')
        .sort({ order: 1 })
        .lean(),
      firstPackageHeadStart(language),
    ]);

    const allPuzzleIds = packages.flatMap(pkg => pkg.puzzleIds);
    const progressDocs = allPuzzleIds.length
      ? await UserPuzzleProgress.find({
          userId: user._id,
          puzzleId: { $in: allPuzzleIds }
        })
          .select('puzzleId completedCluesCount totalClues isCompleted lastPlayedAt')
          .lean()
      : [];
    await attachOpenerClueIds(user._id, headStart, progressDocs);

    const userId = toIdString(user._id) ?? String(user._id);
    // Progress rows stay { puzzleId, progress, lastPlayedAt }. The etag is this
    // user's rings for this language, so one player's 304 cannot be reused.
    sendCachedJson(
      req,
      res,
      progressEtagSource({ userId, language, packages, headStart, progressDocs }),
      () => buildPackageProgress({ packages, headStart, progressDocs })
    );
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

