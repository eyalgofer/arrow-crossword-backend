/**
 * Deletes ALL puzzles, packages, daily/multiplayer assignments, and user
 * puzzle progress. Use before reseeding with a fresh generation batch.
 *
 * Usage: npx ts-node src/scripts/resetPuzzles.ts
 */

import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { MultiplayerPuzzle } from '../models/MultiplayerPuzzle';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';

dotenv.config();

const main = async () => {
  try {
    await connectToDatabase();

    const results = {
      puzzles: await Puzzle.deleteMany({}),
      packages: await PuzzlePackage.deleteMany({}),
      daily: await DailyPuzzle.deleteMany({}),
      multiplayer: await MultiplayerPuzzle.deleteMany({}),
      progress: await UserPuzzleProgress.deleteMany({}),
    };

    console.log('🧹 Reset complete:');
    console.log(`   Puzzles deleted: ${results.puzzles.deletedCount}`);
    console.log(`   Packages deleted: ${results.packages.deletedCount}`);
    console.log(`   Daily assignments deleted: ${results.daily.deletedCount}`);
    console.log(`   Multiplayer assignments deleted: ${results.multiplayer.deletedCount}`);
    console.log(`   User progress deleted: ${results.progress.deletedCount}`);

    await closeDatabaseAndExit(0);
  } catch (e) {
    await handleScriptError(e);
  }
};

main();
