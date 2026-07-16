import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { MultiplayerPuzzle } from '../models/MultiplayerPuzzle';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { Difficulty } from '../types';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError, filterValidPuzzles } from './utils/scriptUtils';

dotenv.config();

const MULTIPLAYER_GRID_ROWS = 10;
const MULTIPLAYER_GRID_COLS = 10;
const MULTIPLAYER_PUZZLE_COUNT = 10;

const seedMultiplayer = async () => {
  try {
    await connectToDatabase();
    console.log(`🎮 Generating ${MULTIPLAYER_PUZZLE_COUNT} multiplayer puzzles: easy ${MULTIPLAYER_GRID_ROWS}x${MULTIPLAYER_GRID_COLS}...\n`);

    const batch = generatePuzzlesBatch({
      difficulty: Difficulty.EASY,
      count: MULTIPLAYER_PUZZLE_COUNT,
      category: 'Multiplayer',
      startIndex: 0,
      rows: MULTIPLAYER_GRID_ROWS,
      cols: MULTIPLAYER_GRID_COLS,
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
        title: `Multiplayer Puzzle ${index + 1}`
      }))
    );

    console.log(`✅ Saved ${savedPuzzles.length} puzzles to Puzzles collection\n`);

    // Clean up invalid indexes
    const deleted = await MultiplayerPuzzle.deleteMany({ 
      $or: [{ index: { $exists: false } }, { index: null }] 
    });
    if (deleted.deletedCount > 0) {
      console.log(`   Cleaned up ${deleted.deletedCount} invalid multiplayer puzzle assignments\n`);
    }

    // Assign puzzles to MultiplayerPuzzle collection
    const assignments = await Promise.all(
      savedPuzzles.slice(0, MULTIPLAYER_PUZZLE_COUNT).map(async (puzzle, i) => {
        const existing = await MultiplayerPuzzle.findOne({ index: i });
        if (existing) {
          existing.puzzleId = puzzle._id;
          await existing.save();
          console.log(`   Updated index ${i}: ${puzzle.title} (${puzzle._id})`);
          return existing;
        } else {
          const multiplayerPuzzle = new MultiplayerPuzzle({
            puzzleId: puzzle._id,
            index: i
          });
          await multiplayerPuzzle.save();
          console.log(`   Assigned index ${i}: ${puzzle.title} (${puzzle._id})`);
          return multiplayerPuzzle;
        }
      })
    );

    console.log(`\n✅ Successfully assigned ${assignments.length} puzzles to MultiplayerPuzzle collection:`);
    savedPuzzles.forEach((puzzle, index) => {
      console.log(`   Index ${index}: ${puzzle.title} (${puzzle._id})`);
    });

    console.log(`\n📊 Total multiplayer puzzle assignments: ${await MultiplayerPuzzle.countDocuments()}`);
    await closeDatabaseAndExit(0);
  } catch (error) {
    await handleScriptError(error);
  }
};

seedMultiplayer();
