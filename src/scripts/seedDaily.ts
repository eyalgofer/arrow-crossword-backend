import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { assignPuzzlesToDateRange } from '../utils/dailyPuzzleUtils';
import { Difficulty, Language } from '../types';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError, filterValidPuzzles } from './utils/scriptUtils';
import {
  ImageClueCatalogEntry,
  loadGeneratedImageClueCatalog,
  loadImageClueCatalogFromMongo,
} from './generators/imageClueCatalog';
import { IMAGE_CLUE_SIZE_LADDER } from './utils/gridSizes';
import { normalizeWord } from './generators/validation-utils';

dotenv.config();

const DAILY_GRID_ROWS = 13;
const DAILY_GRID_COLS = 13;
const DAILY_PUZZLE_COUNT = 3;

// Usage: ts-node src/scripts/seedDaily.ts [--lang he]
const langArgIndex = process.argv.indexOf('--lang');
const language: Language = langArgIndex !== -1 && process.argv[langArgIndex + 1] === 'he' ? 'he' : 'en';

const DAILY_CATEGORY = language === 'he' ? 'יומי' : 'Daily';
const dailyTitle = (index: number) => language === 'he' ? `תשחץ יומי ${index + 1}` : `Daily Puzzle ${index + 1}`;

function mergeCatalogs(
  mongo: ImageClueCatalogEntry[],
  local: ImageClueCatalogEntry[]
): ImageClueCatalogEntry[] {
  const byAnswer = new Map<string, ImageClueCatalogEntry>();
  for (const entry of [...mongo, ...local]) {
    if (!entry.answer || !entry.imageUrl) continue;
    byAnswer.set(normalizeWord(entry.answer), entry);
  }
  return [...byAnswer.values()];
}

const seedDaily = async () => {
  try {
    await connectToDatabase();

    let imageClueCatalog: ImageClueCatalogEntry[] | undefined;
    let imageClueCount = 0;
    if (language === 'he') {
      const mongoCatalog = await loadImageClueCatalogFromMongo();
      const localCatalog = loadGeneratedImageClueCatalog();
      imageClueCatalog = mergeCatalogs(mongoCatalog, localCatalog);
      if (imageClueCatalog.length < 2) {
        console.error(
          `Need image clues, found ${imageClueCatalog.length}. ` +
            `Run scripts/arrow-image-pipeline \`npm run process\` first.`
        );
        await closeDatabaseAndExit(1);
        return;
      }
      imageClueCount = 2;
    }

    const sizeLabel =
      language === 'he'
        ? '13–15 mixed-arrow grids with 2 images'
        : `easy ${DAILY_GRID_ROWS}x${DAILY_GRID_COLS}`;
    console.log(`📅 Generating ${DAILY_PUZZLE_COUNT} daily puzzles (${language}): ${sizeLabel}...\n`);

    const batch = generatePuzzlesBatch({
      difficulty: Difficulty.EASY,
      count: DAILY_PUZZLE_COUNT,
      category: DAILY_CATEGORY,
      startIndex: 0,
      rows: DAILY_GRID_ROWS,
      cols: DAILY_GRID_COLS,
      sizes: language === 'he' ? IMAGE_CLUE_SIZE_LADDER : undefined,
      language,
      strictSize: language === 'he',
      imageClueCount,
      imageClueCatalog,
      imageClueAttempts: imageClueCount > 0 ? 48 : undefined,
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
