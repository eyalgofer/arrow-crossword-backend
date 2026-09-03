/**
 * Generate Hebrew 10x10 daily puzzles and assign them from today
 * through the next three months (unless --count is set).
 *
 * About 25–50% of each puzzle's answers come from tagged difficulty-1 vocab.
 *
 * Usage:
 *   npx ts-node src/scripts/seedHebrewDailies60.ts
 *   npx ts-node src/scripts/seedHebrewDailies60.ts --count 1
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Puzzle } from '../models/Puzzle';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { PuzzleGenerator } from './generators/puzzlesGenerator';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { assignPuzzleToDate, getDayOfYear } from '../utils/dailyPuzzleUtils';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';

dotenv.config();

const countArgIndex = process.argv.indexOf('--count');
const ROWS = 13;
const COLS = 13;
const CATEGORY = 'יומי';
const LANGUAGE = 'he' as const;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function defaultCount(): number {
  const start = addDays(new Date(), 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

const COUNT = countArgIndex !== -1 ? Number(process.argv[countArgIndex + 1]) : defaultCount();
  
async function ensureMongoConnection(): Promise<void> {
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().command({ ping: 1 });
      return;
    }
  } catch {
    // reconnect below
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => undefined);
  }
  await connectToDatabase();
}

async function replaceDailyAssignment(
  newPuzzleId: mongoose.Types.ObjectId,
  date: Date
): Promise<void> {
  const normalized = addDays(date, 0);
  const year = normalized.getFullYear();
  const dayOfYear = getDayOfYear(normalized);
  const existing = await DailyPuzzle.findOne({ dayOfYear, year, language: LANGUAGE });
  const oldId = existing?.puzzleId;

  await assignPuzzleToDate(newPuzzleId, normalized);

  if (oldId && String(oldId) !== String(newPuzzleId)) {
    await UserPuzzleProgress.deleteMany({ puzzleId: oldId });
    const oldPuzzle = await Puzzle.findById(oldId);
    if (oldPuzzle && !oldPuzzle.packageId) {
      await Puzzle.deleteOne({ _id: oldId });
    }
  }
}

const main = async () => {
  try {
    await connectToDatabase();

    const startDay = addDays(new Date(), 0);
    const lastDay = addDays(startDay, COUNT - 1);
    console.log(
      `📅 Generating ${COUNT} Hebrew ${ROWS}x${COLS} dailies ` +
      `${startDay.toLocaleDateString()} → ${lastDay.toLocaleDateString()}\n`
    );

    const generator = new PuzzleGenerator(LANGUAGE);
    const savedIds: string[] = [];
    let mixSum = 0;

    for (let i = 0; i < COUNT; i++) {
      const date = addDays(startDay, i);
      let saved = null;
      let mixLabel = '';
      for (let attempt = 1; attempt <= 4 && !saved; attempt++) {
        const generated = generator.generateBatch({
          count: 1,
          category: CATEGORY,
          getTitle: () => `תשחץ יומי ${i + 1}`,
          rows: ROWS,
          cols: COLS,
          strictSize: true,
        });
        const puzzle = generated[0];
        if (!puzzle) continue;
        const errors = validatePuzzleBoundaries(puzzle);
        if (errors.length > 0) {
          console.warn(`   ⚠️  Puzzle ${i + 1} failed validation (try ${attempt})`);
          continue;
        }
        if (puzzle.grid.rows !== ROWS || puzzle.grid.cols !== COLS) {
          console.warn(`   ⚠️  Got ${puzzle.grid.rows}x${puzzle.grid.cols} (try ${attempt})`);
          continue;
        }
       
        await ensureMongoConnection();
        const inserted = await Puzzle.insertMany([{ ...puzzle, title: `תשחץ יומי ${i + 1}` }]);
        saved = inserted[0];
      }

      if (!saved) {
        console.error(`❌ Could not generate a valid 10x10 for day ${i + 1} (${date.toLocaleDateString()})`);
        continue;
      }

      await ensureMongoConnection();
      await replaceDailyAssignment(saved._id as mongoose.Types.ObjectId, date);
      savedIds.push(String(saved._id));
      console.log(
        `   ${date.toLocaleDateString()} → ${saved.title} ` +
        `(${saved.grid.rows}x${saved.grid.cols}, ${saved.puzzleItems.length} clues, ${mixLabel})`
      );
      if (COUNT === 1) {
        console.log(`   puzzleId: ${saved._id}`);
        for (const item of saved.puzzleItems) {
          const enumeration = item.enumeration;
          const enumLabel = enumeration && enumeration.length > 1 ? ` (${enumeration.join(',')})` : '';
          console.log(`   ${item.number}. ${item.clue}${enumLabel} = ${item.answer}`);
        }
      }
    }

    const avg = savedIds.length === 0 ? 0 : Math.round((100 * mixSum) / savedIds.length);
    console.log(`\n✅ Assigned ${savedIds.length}/${COUNT} Hebrew 10x10 dailies (avg easy-vocab ${avg}%)`);
    console.log(`📊 Total daily assignments: ${await DailyPuzzle.countDocuments()}`);
    await closeDatabaseAndExit(savedIds.length === COUNT ? 0 : 1);
  } catch (error) {
    await handleScriptError(error);
  }
};

main();
