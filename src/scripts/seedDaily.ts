import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { assignPuzzlesToDateRange } from '../utils/dailyPuzzleUtils';
import { Difficulty } from '../types';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError, filterValidPuzzles } from './utils/scriptUtils';

dotenv.config();

const DAILY_GRID_ROWS = 11;
const DAILY_GRID_COLS = 11;
const DAILY_PUZZLE_COUNT = 10;

const seedDaily = async () => {
  try {
    await connectToDatabase();
    console.log(`📅 Generating ${DAILY_PUZZLE_COUNT} daily puzzles: easy ${DAILY_GRID_ROWS}x${DAILY_GRID_COLS}...\n`);

    const batch = generatePuzzlesBatch({
      difficulty: Difficulty.EASY,
      count: DAILY_PUZZLE_COUNT,
      category: 'Daily',
      startIndex: 0,
      rows: DAILY_GRID_ROWS,
      cols: DAILY_GRID_COLS,
    });

    const validPuzzles = filterValidPuzzles(batch, validatePuzzleBoundaries);

    if (validPuzzles.length === 0) {
      console.error('❌ No valid puzzles generated. Try running again.');
      await closeDatabaseAndExit(1);
    }

    console.log(`✅ Generated ${validPuzzles.length} valid puzzles\n`);

    // Save puzzles to Puzzles collection
    const savedPuzzles = await Puzzle.insertMany(
      validPuzzles.map((puzzle, index) => ({
        ...puzzle,
        title: `Daily Puzzle ${index + 1}`
      }))
    );

    console.log(`✅ Saved ${savedPuzzles.length} puzzles to Puzzles collection\n`);

    // Start from today
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    console.log(`📅 Assigning puzzles starting from: ${startDate.toLocaleDateString()}\n`);

    const puzzleIds = savedPuzzles.map(p => p._id);
    const assignments = await assignPuzzlesToDateRange(puzzleIds, startDate);

    console.log(`\n✅ Successfully assigned ${assignments.length} puzzles to daily dates:`);
    assignments.forEach((assignment, index) => {
      const puzzle = savedPuzzles[index];
      console.log(`   ${assignment.date.toLocaleDateString()} → ${puzzle.title} (${puzzle._id})`);
    });

    console.log(`\n📊 Total daily puzzle assignments: ${await DailyPuzzle.countDocuments()}`);
    await closeDatabaseAndExit(0);
  } catch (error) {
    await handleScriptError(error);
  }
};

seedDaily();
