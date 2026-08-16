import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { connectDatabase } from '../config/database';
import { assignPuzzlesToDateRange } from '../utils/dailyPuzzleUtils';
import { closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';
import { Language } from '../types';

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
      .select('_id title language');

    if (puzzles.length === 0) {
      console.error('❌ No active puzzles found! Please seed puzzles first.');
      await closeDatabaseAndExit(1);
    }

    const byLanguage = new Map<Language, typeof puzzles>();
    for (const puzzle of puzzles) {
      const language: Language = puzzle.language === 'he' ? 'he' : 'en';
      const list = byLanguage.get(language) ?? [];
      list.push(puzzle);
      byLanguage.set(language, list);
    }

    console.log(`📦 Found ${puzzles.length} active puzzles:`);
    for (const [language, list] of byLanguage) {
      console.log(`   ${language}: ${list.length}`);
      list.forEach((puzzle, index) => {
        console.log(`      ${index + 1}. ${puzzle.title} (${puzzle._id})`);
      });
    }
    console.log('');

    const existingAssignments = await DailyPuzzle.countDocuments();
    if (existingAssignments > 0) {
      console.log(`⚠️  Warning: Found ${existingAssignments} existing daily puzzle assignments.`);
      console.log('   New assignments will update existing ones for the same dates and language.\n');
    }

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    console.log(`📅 Assigning puzzles starting from: ${startDate.toLocaleDateString()}\n`);

    const assignments = [];
    for (const [language, list] of byLanguage) {
      const puzzleIds = list.map(p => p._id);
      const languageAssignments = await assignPuzzlesToDateRange(puzzleIds, startDate);
      assignments.push(...languageAssignments);
      languageAssignments.forEach((assignment, index) => {
        const puzzle = list[index];
        console.log(`   [${language}] ${assignment.date.toLocaleDateString()} → ${puzzle.title}`);
      });
    }

    console.log(`\n📊 Total daily puzzle assignments: ${await DailyPuzzle.countDocuments()}`);
    console.log('\n✅ Done!');
    await closeDatabaseAndExit(0);
  } catch (error) {
    await handleScriptError(error);
  }
};

assignDailyPuzzles();
