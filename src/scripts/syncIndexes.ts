/**
 * Sync MongoDB indexes with the current schema definitions.
 *
 * Required once after the Hebrew localization change:
 *  - DailyPuzzle unique indexes are now per-language ({ date, language },
 *    { dayOfYear, year, language }) so English and Hebrew dailies can coexist.
 *  - PuzzlePackage unique name is now { name, language }.
 *  - MultiplayerPuzzle unique index is now { index, language }.
 *
 * syncIndexes drops indexes that no longer match the schema and creates the new ones.
 *
 * Usage: npm run sync:indexes
 */

import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { MultiplayerPuzzle } from '../models/MultiplayerPuzzle';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { Match } from '../models/Match';
import { MatchWordClaim } from '../models/MatchWordClaim';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';

dotenv.config();

const syncIndexes = async () => {
  try {
    await connectToDatabase();

    for (const model of [Puzzle, PuzzlePackage, DailyPuzzle, MultiplayerPuzzle, User, RefreshToken, Match, MatchWordClaim]) {
      const dropped = await model.syncIndexes();
      console.log(`✅ ${model.modelName}: indexes synced${dropped.length > 0 ? ` (dropped: ${dropped.join(', ')})` : ''}`);
    }

    await closeDatabaseAndExit(0);
  } catch (error) {
    await handleScriptError(error);
  }
};

syncIndexes();
