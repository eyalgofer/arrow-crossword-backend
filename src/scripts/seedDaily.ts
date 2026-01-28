import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { Difficulty } from '../types';

dotenv.config();

const DAILY_GRID_ROWS = 10;
const DAILY_GRID_COLS = 10;

const seedDaily = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arrow-crossword';

    console.log('\n🔍 Connection Details:');
    console.log(`   MONGODB_URI from env: ${process.env.MONGODB_URI ? 'SET' : 'NOT SET'}`);

    if (mongoUri.includes('mongodb+srv://') || mongoUri.includes('mongodb://')) {
      const uriParts = mongoUri.split('/');
      const lastPart = uriParts[uriParts.length - 1];

      if (lastPart.includes('?')) {
        const [dbName, options] = lastPart.split('?');
        if (!dbName || dbName === 'test') {
          uriParts[uriParts.length - 1] = `arrow-crossword?${options}`;
          mongoUri = uriParts.join('/');
        }
      } else {
        if (!lastPart || lastPart === 'test') {
          mongoUri = mongoUri.endsWith('/') ? `${mongoUri}arrow-crossword` : `${mongoUri}/arrow-crossword`;
        }
      }
    }

    console.log(`   Using URI: ${mongoUri.substring(0, 50)}...`);

    await mongoose.connect(mongoUri);

    const dbName = mongoose.connection.db?.databaseName;
    const host = mongoose.connection.host;

    console.log(`✅ Connected to MongoDB`);
    console.log(`   Host: ${host}`);
    console.log(`   Database: ${dbName}`);
    console.log('');

    console.log(`📅 Generating daily puzzle: easy ${DAILY_GRID_ROWS}x${DAILY_GRID_COLS}...\n`);

    const batch = generatePuzzlesBatch({
      difficulty: Difficulty.EASY,
      count: 1,
      category: 'Daily',
      startIndex: 0,
      rows: DAILY_GRID_ROWS,
      cols: DAILY_GRID_COLS,
    });

    const validPuzzles: any[] = [];
    for (const puzzle of batch) {
      const boundaryErrors = validatePuzzleBoundaries(puzzle);
      if (boundaryErrors.length === 0) {
        validPuzzles.push(puzzle);
      } else {
        console.warn('   ⚠️  Generated puzzle failed boundary validation:', boundaryErrors);
      }
    }

    if (validPuzzles.length === 0) {
      console.error('❌ No valid puzzle generated. Try running again.');
      await mongoose.connection.close();
      process.exit(1);
    }

    const puzzleToSave = validPuzzles[0];
    puzzleToSave.title = 'Daily Puzzle';

    const saved = await Puzzle.create(puzzleToSave);

    console.log('✅ Daily puzzle added to Puzzles collection:');
    console.log(`   _id: ${saved._id}`);
    console.log(`   title: ${saved.title}`);
    console.log(`   grid: ${saved.grid.rows}x${saved.grid.cols}`);
    console.log(`   difficulty: ${saved.difficulty}`);
    console.log(`   puzzleItems: ${saved.puzzleItems.length}`);
    console.log('\n   (Existing puzzles were not modified.)');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

seedDaily();
