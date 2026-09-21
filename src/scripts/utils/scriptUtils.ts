import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database';
import { Puzzle } from '../../models/Puzzle';
import { PuzzlePackage } from '../../models/PuzzlePackage';
import { DailyPuzzle } from '../../models/DailyPuzzle';
import { MultiplayerPuzzle } from '../../models/MultiplayerPuzzle';
import { UserPuzzleProgress } from '../../models/UserPuzzleProgress';
import { Language } from '../../types';

/**
 * Connect to MongoDB using the shared database utility
 */
export async function connectToDatabase(): Promise<void> {
  await connectDatabase();
}

/**
 * Close MongoDB connection and exit process
 */
export async function closeDatabaseAndExit(code: number = 0): Promise<never> {
  await mongoose.connection.close();
  process.exit(code);
}

/**
 * Handle script errors with proper cleanup
 */
export async function handleScriptError(error: unknown): Promise<never> {
  console.error('❌ Script error:', error);
  if (error instanceof Error) {
    console.error('   Message:', error.message);
  }
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
}

/**
 * Delete one language's puzzles, packages, daily/multiplayer slots, and their progress.
 */
export async function clearPuzzlesForLanguage(language: Language): Promise<void> {
  const puzzles = await Puzzle.find({ language }).select('_id');
  const ids = puzzles.map(p => p._id);

  const progress = ids.length
    ? await UserPuzzleProgress.deleteMany({ puzzleId: { $in: ids } })
    : { deletedCount: 0 };
  const daily = await DailyPuzzle.deleteMany({ language });
  const multiplayer = await MultiplayerPuzzle.deleteMany({ language });
  const packages = await PuzzlePackage.deleteMany({ language });
  const puzzleResult = await Puzzle.deleteMany({ language });

  console.log(`🧹 Cleared ${language} puzzle content:`);
  console.log(`   Puzzles: ${puzzleResult.deletedCount}`);
  console.log(`   Packages: ${packages.deletedCount}`);
  console.log(`   Daily: ${daily.deletedCount}`);
  console.log(`   Multiplayer: ${multiplayer.deletedCount}`);
  console.log(`   User progress: ${progress.deletedCount}`);
}

/**
 * Delete only packaged puzzles + packages + their progress for a language.
 * Leaves dailies, multiplayer, and non-package puzzles untouched.
 */
export async function clearPackagesForLanguage(language: Language): Promise<void> {
  const packages = await PuzzlePackage.find({ language }).select('_id puzzleIds');
  const fromPackages = packages.flatMap(pkg => pkg.puzzleIds);
  const packagedDocs = await Puzzle.find({
    language,
    packageId: { $exists: true, $ne: null },
  }).select('_id');
  const idSet = new Set<string>([
    ...fromPackages.map(id => String(id)),
    ...packagedDocs.map(p => String(p._id)),
  ]);
  const ids = [...idSet].map(id => new mongoose.Types.ObjectId(id));

  const progress = ids.length
    ? await UserPuzzleProgress.deleteMany({ puzzleId: { $in: ids } })
    : { deletedCount: 0 };
  const puzzleResult = ids.length
    ? await Puzzle.deleteMany({ _id: { $in: ids } })
    : { deletedCount: 0 };
  const packageResult = await PuzzlePackage.deleteMany({ language });

  console.log(`🧹 Cleared ${language} packages only:`);
  console.log(`   Puzzles: ${puzzleResult.deletedCount}`);
  console.log(`   Packages: ${packageResult.deletedCount}`);
  console.log(`   User progress: ${progress.deletedCount}`);
}

/**
 * Filter valid puzzles by boundary validation
 */
export function filterValidPuzzles(puzzles: any[], validateFn: (puzzle: any) => string[]): any[] {
  return puzzles.filter(puzzle => {
    const errors = validateFn(puzzle);
    if (errors.length > 0) {
      console.warn('   ⚠️  Generated puzzle failed boundary validation:', errors);
      return false;
    }
    return true;
  });
}
