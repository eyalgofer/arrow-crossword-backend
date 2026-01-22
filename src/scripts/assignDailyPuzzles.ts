import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { connectDatabase } from '../config/database';
import { assignPuzzlesToDateRange } from '../utils/dailyPuzzleUtils';

dotenv.config();

/**
 * Script to assign existing puzzles to daily puzzle dates
 * Starting from today, assigns one puzzle per day
 */
// TODO: will need another script like this to assign daily puzzles by day in year
const assignDailyPuzzles = async () => {
  try {
    console.log('🚀 Starting daily puzzle assignment...\n');

    // Connect to database
    await connectDatabase();
    console.log('✅ Connected to database\n');

    // Get all active puzzles
    const puzzles = await Puzzle.find({ isActive: { $ne: false } })
      .sort({ createdAt: 1 })
      .select('_id title');

    if (puzzles.length === 0) {
      console.error('❌ No active puzzles found! Please seed puzzles first.');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`📦 Found ${puzzles.length} active puzzles:`);
    puzzles.forEach((puzzle, index) => {
      console.log(`   ${index + 1}. ${puzzle.title} (${puzzle._id})`);
    });
    console.log('');

    // Check if there are existing daily puzzle assignments
    const existingAssignments = await DailyPuzzle.countDocuments();
    if (existingAssignments > 0) {
      console.log(`⚠️  Warning: Found ${existingAssignments} existing daily puzzle assignments.`);
      console.log('   New assignments will update existing ones for the same dates.\n');
    }

    // Start from today
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Set to start of day

    console.log(`📅 Assigning puzzles starting from: ${startDate.toLocaleDateString()}\n`);

    // Get puzzle IDs
    const puzzleIds = puzzles.map(p => p._id);

    // Assign puzzles to dates
    const assignments = await assignPuzzlesToDateRange(puzzleIds, startDate);

    console.log(`\n✅ Successfully assigned ${assignments.length} puzzles to daily dates:`);
    assignments.forEach((assignment, index) => {
      const puzzle = puzzles[index];
      console.log(`   ${assignment.date.toLocaleDateString()} → ${puzzle.title}`);
    });

    console.log(`\n📊 Total daily puzzle assignments: ${await DailyPuzzle.countDocuments()}`);

    await mongoose.connection.close();
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error assigning daily puzzles:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
assignDailyPuzzles();
