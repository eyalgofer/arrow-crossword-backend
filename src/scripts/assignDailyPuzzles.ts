import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { connectDatabase } from '../config/database';
import { assignPuzzlesToDateRange } from '../utils/dailyPuzzleUtils';
import { closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';

dotenv.config();

/**
 * Script to assign existing puzzles to daily puzzle dates
 * Starting from today, assigns one puzzle per day
 */
const assignDailyPuzzles = async () => {
  try {
    console.log('🚀 Starting daily puzzle assignment...\n');
    await connectDatabase();
    console.log('✅ Connected to database\n');

    const puzzles = await Puzzle.find({ isActive: { $ne: false } })
      .sort({ createdAt: 1 })
      .select('_id title');

    if (puzzles.length === 0) {
      console.error('❌ No active puzzles found! Please seed puzzles first.');
      await closeDatabaseAndExit(1);
    }

    console.log(`📦 Found ${puzzles.length} active puzzles:`);
    puzzles.forEach((puzzle, index) => {
      console.log(`   ${index + 1}. ${puzzle.title} (${puzzle._id})`);
    });
    console.log('');

    const existingAssignments = await DailyPuzzle.countDocuments();
    if (existingAssignments > 0) {
      console.log(`⚠️  Warning: Found ${existingAssignments} existing daily puzzle assignments.`);
      console.log('   New assignments will update existing ones for the same dates.\n');
    }

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    console.log(`📅 Assigning puzzles starting from: ${startDate.toLocaleDateString()}\n`);

    const puzzleIds = puzzles.map(p => p._id);
    const assignments = await assignPuzzlesToDateRange(puzzleIds, startDate);

    console.log(`\n✅ Successfully assigned ${assignments.length} puzzles to daily dates:`);
    assignments.forEach((assignment, index) => {
      const puzzle = puzzles[index];
      console.log(`   ${assignment.date.toLocaleDateString()} → ${puzzle.title}`);
    });

    console.log(`\n📊 Total daily puzzle assignments: ${await DailyPuzzle.countDocuments()}`);
    console.log('\n✅ Done!');
    await closeDatabaseAndExit(0);
  } catch (error) {
    await handleScriptError(error);
  }
};

assignDailyPuzzles();
