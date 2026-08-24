/**
 * Generate 60 Hebrew 10x10 daily puzzles and assign them from today
 * through ~two months so the app can serve them by date.
 *
 * Usage: npx ts-node src/scripts/seedHebrewDailies60.ts
 */

import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { PuzzleGenerator } from './generators/puzzlesGenerator';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { assignPuzzleToDate } from '../utils/dailyPuzzleUtils';
import { Difficulty } from '../types';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';

dotenv.config();

const COUNT = 60;
const ROWS = 10;
const COLS = 10;
const CATEGORY = 'יומי';

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
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

    const generator = new PuzzleGenerator(Difficulty.EASY, 'he');
    const savedIds: string[] = [];

    for (let i = 0; i < COUNT; i++) {
      const date = addDays(startDay, i);
      let saved = null;
      for (let attempt = 1; attempt <= 8 && !saved; attempt++) {
        const generated = generator.generateBatch({
          count: 1,
          category: CATEGORY,
          getTitle: () => `תשבץ יומי ${i + 1}`,
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
        const inserted = await Puzzle.insertMany([{ ...puzzle, title: `תשבץ יומי ${i + 1}` }]);
        saved = inserted[0];
      }

      if (!saved) {
        console.error(`❌ Could not generate a valid 10x10 for day ${i + 1} (${date.toLocaleDateString()})`);
        continue;
      }

      const assignment = await assignPuzzleToDate(saved._id, date);
      savedIds.push(String(saved._id));
      console.log(
        `   ${assignment.date.toLocaleDateString()} → ${saved.title} ` +
        `(${saved.grid.rows}x${saved.grid.cols}, ${saved.puzzleItems.length} clues)`
      );
    }

    console.log(`\n✅ Assigned ${savedIds.length}/${COUNT} Hebrew 10x10 dailies`);
    console.log(`📊 Total daily assignments: ${await DailyPuzzle.countDocuments()}`);
    await closeDatabaseAndExit(savedIds.length === COUNT ? 0 : 1);
  } catch (error) {
    await handleScriptError(error);
  }
};

main();
