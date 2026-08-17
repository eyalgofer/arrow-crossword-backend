import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { MultiplayerPuzzle } from '../models/MultiplayerPuzzle';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { Difficulty, Language } from '../types';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError, filterValidPuzzles } from './utils/scriptUtils';

dotenv.config();

const MULTIPLAYER_GRID_ROWS = 8;
const MULTIPLAYER_GRID_COLS = 8;
const MULTIPLAYER_PUZZLE_COUNT = 10;

// Usage: ts-node src/scripts/seedMultiplayer.ts [--lang he]
const langArgIndex = process.argv.indexOf('--lang');
const language: Language = langArgIndex !== -1 && process.argv[langArgIndex + 1] === 'he' ? 'he' : 'en';

const MULTIPLAYER_CATEGORY = language === 'he' ? 'רב־משתתפים' : 'Multiplayer';
const multiplayerTitle = (index: number) =>
  language === 'he' ? `תשבץ קרב ${index + 1}` : `Multiplayer Puzzle ${index + 1}`;

const seedMultiplayer = async () => {
  try {
    await connectToDatabase();
    console.log(
      `🎮 Generating ${MULTIPLAYER_PUZZLE_COUNT} multiplayer puzzles (${language}): easy ${MULTIPLAYER_GRID_ROWS}x${MULTIPLAYER_GRID_COLS}...\n`
    );

    const batch = generatePuzzlesBatch({
      difficulty: Difficulty.EASY,
      count: MULTIPLAYER_PUZZLE_COUNT,
      category: MULTIPLAYER_CATEGORY,
      startIndex: 0,
      rows: MULTIPLAYER_GRID_ROWS,
      cols: MULTIPLAYER_GRID_COLS,
      language,
    });

    const validPuzzles = filterValidPuzzles(batch, validatePuzzleBoundaries);

    if (validPuzzles.length === 0) {
      console.error('❌ No valid puzzles generated. Try running again.');
      await closeDatabaseAndExit(1);
    }

    console.log(`✅ Generated ${validPuzzles.length} valid puzzles\n`);

    const savedPuzzles = await Puzzle.insertMany(
      validPuzzles.map((puzzle, index) => ({
        ...puzzle,
        title: multiplayerTitle(index)
      }))
    );

    console.log(`✅ Saved ${savedPuzzles.length} puzzles to Puzzles collection\n`);

    const deleted = await MultiplayerPuzzle.deleteMany({
      language,
      $or: [{ index: { $exists: false } }, { index: null }]
    });
    if (deleted.deletedCount > 0) {
      console.log(`   Cleaned up ${deleted.deletedCount} invalid ${language} multiplayer puzzle assignments\n`);
    }

    const assignments = await Promise.all(
      savedPuzzles.slice(0, MULTIPLAYER_PUZZLE_COUNT).map(async (puzzle, i) => {
        const existing = await MultiplayerPuzzle.findOne({ index: i, language });
        if (existing) {
          existing.puzzleId = puzzle._id;
          existing.language = language;
          await existing.save();
          console.log(`   Updated index ${i} (${language}): ${puzzle.title} (${puzzle._id})`);
          return existing;
        }

        const multiplayerPuzzle = new MultiplayerPuzzle({
          puzzleId: puzzle._id,
          index: i,
          language
        });
        await multiplayerPuzzle.save();
        console.log(`   Assigned index ${i} (${language}): ${puzzle.title} (${puzzle._id})`);
        return multiplayerPuzzle;
      })
    );

    console.log(`\n✅ Successfully assigned ${assignments.length} ${language} puzzles to MultiplayerPuzzle:`);
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
