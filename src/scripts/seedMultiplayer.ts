/**
 * Generate multiplayer puzzles and wire them to MultiplayerPuzzle slots.
 *
 * Hebrew: 15×15 with 2 image clues (parallel workers).
 * English: easy 8×8 text puzzles.
 *
 * Usage:
 *   npm run seed:multiplayer:he              # replace slots 0–19
 *   npm run seed:multiplayer:he -- --add 20  # append 20 more Hebrew slots
 *   npm run seed:multiplayer
 */

import dotenv from 'dotenv';
dotenv.config();

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Puzzle } from '../models/Puzzle';
import { MultiplayerPuzzle } from '../models/MultiplayerPuzzle';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { Difficulty, Language } from '../types';
import {
  connectToDatabase,
  closeDatabaseAndExit,
  handleScriptError,
  filterValidPuzzles,
} from './utils/scriptUtils';
import {
  ImageClueCatalogEntry,
  loadGeneratedImageClueCatalog,
  loadImageClueCatalogFromMongo,
} from './generators/imageClueCatalog';
import { Puzzle as GeneratedPuzzle } from './core/types';
import { normalizeWord } from './generators/validation-utils';
import { getUncoveredCells } from './generators/direction-utils';

const MULTIPLAYER_GRID_ROWS = 8;
const MULTIPLAYER_GRID_COLS = 8;
const DEFAULT_COUNT = 20;
const IMAGE_COUNT = 2;
const ATTEMPTS = 30;
const PARALLEL = 6;
const ROOT = path.join(__dirname, '../..');
const CATALOG_FILE = path.join(ROOT, 'tmp-multiplayer-catalog.json');
const OUT_DIR = path.join(ROOT, 'tmp-multiplayer-puzzles');

function argValue(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const language: Language = argValue('--lang') === 'he' ? 'he' : 'en';
const ADD_COUNT = argValue('--add') ? parseInt(argValue('--add')!, 10) : 0;
const APPEND = ADD_COUNT > 0;
const TARGET_COUNT = APPEND ? ADD_COUNT : DEFAULT_COUNT;

const MULTIPLAYER_CATEGORY = language === 'he' ? 'רב־משתתפים' : 'Multiplayer';
const multiplayerTitle = (index: number) =>
  language === 'he' ? `תשחץ קרב ${index + 1}` : `Multiplayer Puzzle ${index + 1}`;

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

function puzzleIsReady(puzzle: GeneratedPuzzle): boolean {
  const images = puzzle.puzzleItems.filter((item) => item.clueType === 'image');
  return (
    puzzle.grid?.rows >= 15 &&
    puzzle.grid?.cols >= 15 &&
    images.length >= IMAGE_COUNT &&
    getUncoveredCells(puzzle).length === 0 &&
    validatePuzzleBoundaries(puzzle).length === 0
  );
}

function puzzleFingerprint(puzzle: GeneratedPuzzle): string {
  const answers = puzzle.puzzleItems
    .map((item) => normalizeWord(String(item.answer || '')))
    .filter(Boolean)
    .sort()
    .join('|');
  return `${puzzle.grid.rows}x${puzzle.grid.cols}:${answers}`;
}

function loadReadyFromDir(dir: string, pattern: RegExp): GeneratedPuzzle[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((name) => pattern.test(name))
    .sort();
  const puzzles: GeneratedPuzzle[] = [];
  for (const file of files) {
    try {
      const puzzle = JSON.parse(
        fs.readFileSync(path.join(dir, file), 'utf8')
      ) as GeneratedPuzzle;
      if (puzzleIsReady(puzzle)) puzzles.push(puzzle);
    } catch {
      // skip
    }
  }
  return puzzles;
}

function loadExistingReady(): GeneratedPuzzle[] {
  return loadReadyFromDir(OUT_DIR, /^mp-\d+\.json$/);
}

/** Unique ready boards from daily/fav caches, excluding fingerprints already in `exclude`. */
function loadBorrowableReady(exclude: Set<string>): GeneratedPuzzle[] {
  const sources = [
    ...loadReadyFromDir(path.join(ROOT, 'tmp-daily-puzzles'), /^daily-\d+\.json$/),
    ...loadReadyFromDir(path.join(ROOT, 'tmp-fav-puzzles'), /^fav-\d+\.json$/),
  ];
  const out: GeneratedPuzzle[] = [];
  const seen = new Set(exclude);
  for (const puzzle of sources) {
    const fp = puzzleFingerprint(puzzle);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(puzzle);
  }
  return out;
}

function runWorker(index: number): Promise<GeneratedPuzzle | null> {
  return new Promise((resolve) => {
    const outPath = path.join(OUT_DIR, `mp-${index}.json`);
    const child = spawn(
      'npx',
      [
        'ts-node',
        'src/scripts/generateOneFav.ts',
        '--out',
        outPath,
        '--images',
        String(IMAGE_COUNT),
        '--attempts',
        String(ATTEMPTS),
        '--catalog',
        CATALOG_FILE,
        '--index',
        String(index),
        '--size',
        '15',
      ],
      { cwd: ROOT, stdio: 'inherit' }
    );
    child.on('exit', (code) => {
      if (code !== 0 || !fs.existsSync(outPath)) {
        resolve(null);
        return;
      }
      try {
        const puzzle = JSON.parse(fs.readFileSync(outPath, 'utf8')) as GeneratedPuzzle;
        resolve(puzzleIsReady(puzzle) ? puzzle : null);
      } catch {
        resolve(null);
      }
    });
    child.on('error', () => resolve(null));
  });
}

async function generateHebrewBatch(
  count: number,
  opts: {
    reuseExisting: boolean;
    borrowOtherCaches: boolean;
    excludeFingerprints?: Set<string>;
  } = {
    reuseExisting: true,
    borrowOtherCaches: false,
  }
): Promise<GeneratedPuzzle[]> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const puzzles: GeneratedPuzzle[] = [];
  const used = new Set<string>(opts.excludeFingerprints ?? []);

  const takeIfNew = (puzzle: GeneratedPuzzle): boolean => {
    const fp = puzzleFingerprint(puzzle);
    if (used.has(fp)) return false;
    used.add(fp);
    puzzles.push(puzzle);
    return true;
  };

  // Always harvest unique ready boards already on disk (including partial --add runs).
  {
    const before = puzzles.length;
    for (const puzzle of loadExistingReady()) {
      if (puzzles.length >= count) break;
      takeIfNew(puzzle);
    }
    if (!opts.reuseExisting) {
      // When appending, only keep boards that were NOT in the exclude set originally.
      // loadExistingReady may include old mp-1..20 which are in excludeFingerprints — takeIfNew skips those.
    }
    if (puzzles.length > before) {
      console.log(`♻️  Using ${puzzles.length - before} unique ready board(s) from ${OUT_DIR}`);
    }
  }

  if (opts.borrowOtherCaches && puzzles.length < count) {
    const before = puzzles.length;
    for (const puzzle of loadBorrowableReady(used)) {
      if (puzzles.length >= count) break;
      takeIfNew(puzzle);
    }
    const borrowed = puzzles.length - before;
    if (borrowed > 0) {
      console.log(`📦 Borrowed ${borrowed} unique board(s) from daily/fav caches`);
    }
  }

  if (puzzles.length >= count) {
    return puzzles.slice(0, count);
  }

  const existingIds = fs.existsSync(OUT_DIR)
    ? fs
        .readdirSync(OUT_DIR)
        .map((name) => parseInt(name.replace(/\D/g, ''), 10))
        .filter((n) => Number.isFinite(n))
    : [];
  let nextIndex = 1 + (existingIds.length ? Math.max(...existingIds) : 0);
  let inFlight = 0;
  let launched = 0;
  const maxLaunches = Math.max(80, count * 8);

  console.log(
    `⚙️  Worker pool: up to ${PARALLEL} parallel, need ${count - puzzles.length} more (have ${puzzles.length}/${count})`
  );

  await new Promise<void>((resolve) => {
    const maybeDone = () => {
      if (puzzles.length >= count) {
        resolve();
        return;
      }
      if (inFlight === 0 && launched >= maxLaunches) {
        resolve();
        return;
      }
      pump();
    };

    const pump = () => {
      while (
        puzzles.length + inFlight < count &&
        inFlight < PARALLEL &&
        launched < maxLaunches
      ) {
        const index = nextIndex++;
        launched += 1;
        inFlight += 1;
        console.log(
          `—— Launch worker mp-${index} (in-flight ${inFlight}, have ${puzzles.length}/${count}, launched ${launched}) ——`
        );
        runWorker(index)
          .then((puzzle) => {
            inFlight -= 1;
            if (puzzle && takeIfNew(puzzle)) {
              console.log(`✅ Have ${puzzles.length}/${count} unique ready boards`);
            }
            maybeDone();
          })
          .catch(() => {
            inFlight -= 1;
            maybeDone();
          });
      }
      if (puzzles.length >= count || (inFlight === 0 && launched >= maxLaunches)) {
        resolve();
      }
    };

    pump();
  });

  return puzzles.slice(0, count);
}

async function generateEnglishBatch(count: number): Promise<GeneratedPuzzle[]> {
  const batch = generatePuzzlesBatch({
    difficulty: Difficulty.EASY,
    count,
    category: MULTIPLAYER_CATEGORY,
    startIndex: 0,
    sizes: Array.from({ length: count }, () => ({
      rows: MULTIPLAYER_GRID_ROWS,
      cols: MULTIPLAYER_GRID_COLS,
    })),
    language: 'en',
  });
  return filterValidPuzzles(batch, validatePuzzleBoundaries);
}

const seedMultiplayer = async () => {
  try {
    await connectToDatabase();

    const existing = await MultiplayerPuzzle.find({ language }).sort({ index: 1 }).lean();
    const startIndex = APPEND
      ? (existing.reduce((max, row) => Math.max(max, row.index), -1) + 1)
      : 0;

    if (APPEND && startIndex + TARGET_COUNT - 1 > 99) {
      throw new Error(`Cannot add ${TARGET_COUNT} slots starting at ${startIndex} (max index 99)`);
    }

    let validPuzzles: GeneratedPuzzle[] = [];

    if (language === 'he') {
      const mongoCatalog = await loadImageClueCatalogFromMongo();
      const localCatalog = loadGeneratedImageClueCatalog();
      const catalog = mergeCatalogs(mongoCatalog, localCatalog);
      if (catalog.length < IMAGE_COUNT) {
        throw new Error(
          `Need image clues, found ${catalog.length}. Run scripts/arrow-image-pipeline \`npm run process\` first.`
        );
      }
      fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog));
      console.log(
        APPEND
          ? `🎮 Adding ${TARGET_COUNT} Hebrew multiplayer puzzles from index ${startIndex}: 15×15 with ${IMAGE_COUNT} images (catalog ${catalog.length})...\n`
          : `🎮 Generating ${TARGET_COUNT} Hebrew multiplayer puzzles: 15×15 with ${IMAGE_COUNT} images (catalog ${catalog.length})...\n`
      );
      // Exclude boards already assigned in DB (do not exclude fresh on-disk
      // mp-*.json from a prior partial --add run — those should be reused).
      const excludeFingerprints = new Set<string>();
      if (APPEND && existing.length > 0) {
        const assigned = await Puzzle.find({
          _id: { $in: existing.map((row) => row.puzzleId) },
        }).lean();
        for (const puzzle of assigned) {
          excludeFingerprints.add(puzzleFingerprint(puzzle as unknown as GeneratedPuzzle));
        }
        console.log(
          `🚫 Excluding ${excludeFingerprints.size} board fingerprint(s) already assigned in DB`
        );
      }

      validPuzzles = await generateHebrewBatch(TARGET_COUNT, {
        reuseExisting: !APPEND,
        borrowOtherCaches: APPEND,
        excludeFingerprints,
      });
    } else {
      console.log(
        `🎮 Generating ${TARGET_COUNT} English multiplayer puzzles: easy ${MULTIPLAYER_GRID_ROWS}x${MULTIPLAYER_GRID_COLS}...\n`
      );
      validPuzzles = await generateEnglishBatch(TARGET_COUNT);
    }

    if (validPuzzles.length < TARGET_COUNT) {
      console.warn(
        `⚠️  Only generated ${validPuzzles.length}/${TARGET_COUNT} puzzles`
      );
    }
    if (validPuzzles.length === 0) {
      console.error('❌ No valid puzzles generated. Try running again.');
      await closeDatabaseAndExit(1);
    }

    console.log(`✅ Generated ${validPuzzles.length} valid puzzles\n`);

    const savedPuzzles = await Puzzle.insertMany(
      validPuzzles.map((puzzle, offset) => ({
        ...puzzle,
        title: multiplayerTitle(startIndex + offset),
        category: MULTIPLAYER_CATEGORY,
        language,
      }))
    );

    console.log(`✅ Saved ${savedPuzzles.length} puzzles to Puzzles collection\n`);

    if (!APPEND) {
      const deleted = await MultiplayerPuzzle.deleteMany({
        language,
        $or: [{ index: { $exists: false } }, { index: null }],
      });
      if (deleted.deletedCount > 0) {
        console.log(
          `   Cleaned up ${deleted.deletedCount} invalid ${language} multiplayer puzzle assignments\n`
        );
      }
    }

    const assignments = await Promise.all(
      savedPuzzles.slice(0, TARGET_COUNT).map(async (puzzle, offset) => {
        const index = startIndex + offset;
        const existingSlot = await MultiplayerPuzzle.findOne({ index, language });
        if (existingSlot) {
          existingSlot.puzzleId = puzzle._id;
          existingSlot.language = language;
          await existingSlot.save();
          const images = puzzle.puzzleItems.filter((item) => item.clueType === 'image').length;
          console.log(
            `   Updated index ${index} (${language}): ${puzzle.title} ${puzzle.grid.rows}x${puzzle.grid.cols} images=${images} (${puzzle._id})`
          );
          return existingSlot;
        }

        const multiplayerPuzzle = new MultiplayerPuzzle({
          puzzleId: puzzle._id,
          index,
          language,
        });
        await multiplayerPuzzle.save();
        const images = puzzle.puzzleItems.filter((item) => item.clueType === 'image').length;
        console.log(
          `   Assigned index ${index} (${language}): ${puzzle.title} ${puzzle.grid.rows}x${puzzle.grid.cols} images=${images} (${puzzle._id})`
        );
        return multiplayerPuzzle;
      })
    );

    const totalHe = await MultiplayerPuzzle.countDocuments({ language: 'he' });
    console.log(
      `\n✅ Successfully assigned ${assignments.length} ${language} puzzles to MultiplayerPuzzle`
    );
    console.log(`📊 Hebrew multiplayer slots: ${totalHe}`);
    console.log(
      `📊 Total multiplayer puzzle assignments: ${await MultiplayerPuzzle.countDocuments()}`
    );
    await closeDatabaseAndExit(assignments.length === TARGET_COUNT ? 0 : 1);
  } catch (error) {
    await handleScriptError(error);
  }
};

seedMultiplayer();
