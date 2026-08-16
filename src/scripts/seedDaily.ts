import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { assignPuzzlesToDateRange } from '../utils/dailyPuzzleUtils';
import { Difficulty, Language } from '../types';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError, filterValidPuzzles } from './utils/scriptUtils';

dotenv.config();

const DAILY_GRID_ROWS = 8;
const DAILY_GRID_COLS = 8;
const DAILY_PUZZLE_COUNT = 3;

// Usage: ts-node src/scripts/seedDaily.ts [--lang he]
const langArgIndex = process.argv.indexOf('--lang');
const language: Language = langArgIndex !== -1 && process.argv[langArgIndex + 1] === 'he' ? 'he' : 'en';

// Hebrew users see Hebrew categories and titles
const DAILY_CATEGORY = language === 'he' ? 'יומי' : 'Daily';
const dailyTitle = (index: number) => language === 'he' ? `תשבץ יומי ${index + 1}` : `Daily Puzzle ${index + 1}`;

const seedDaily = async () => {
  try {
    await connectToDatabase();
    console.log(`📅 Generating ${DAILY_PUZZLE_COUNT} daily puzzles (${language}): easy ${DAILY_GRID_ROWS}x${DAILY_GRID_COLS}...\n`);

    const batch = generatePuzzlesBatch({
      difficulty: Difficulty.EASY,
      count: DAILY_PUZZLE_COUNT,
      category: DAILY_CATEGORY,
      startIndex: 0,
      rows: DAILY_GRID_ROWS,
      cols: DAILY_GRID_COLS,
      language,
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
        title: dailyTitle(index)
      }))
    );

    console.log(`✅ Saved ${savedPuzzles.length} puzzles to Puzzles collection\n`);


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
