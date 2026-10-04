/**
 * Generate multiplayer puzzles and wire them to MultiplayerPuzzle slots.
 *
 * Hebrew: 14×14 daily profile with 2 image clues (parallel workers).
 * English: easy 8×8 text puzzles.
 *
 * Usage:
 *   npm run seed:multiplayer:he              # replace Hebrew slots with 30 boards
 *   npm run seed:multiplayer:he -- --add 20  # append 20 more Hebrew slots
 *   npm run seed:multiplayer
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Puzzle } from '../models/Puzzle';
import { MultiplayerPuzzle } from '../models/MultiplayerPuzzle';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
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
import { dailyTargetMisses, dailyTargetsFor, scorePuzzle } from './generators/puzzle-quality';
import {
  RecentDailyContent,
  loadRecentDailyContent,
  writeRecentDailyContent,
} from './utils/recentDailyContent';

const MULTIPLAYER_GRID_ROWS = 8;
const MULTIPLAYER_GRID_COLS = 8;
const HEBREW_COUNT = 30;
const ENGLISH_COUNT = 20;
const GRID_SIZE = 14;
const IMAGE_COUNT = 2;
const PARALLEL = 4;
const ROOT = path.join(__dirname, '../..');
const CATALOG_FILE = path.join(ROOT, 'tmp-multiplayer-catalog.json');
const OUT_DIR = path.join(ROOT, 'tmp-multiplayer-puzzles');
const RECENT_FILE = path.join(ROOT, 'tmp-multiplayer-recent.json');

function argValue(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const language: Language = argValue('--lang') === 'he' ? 'he' : 'en';
const ADD_COUNT = argValue('--add') ? parseInt(argValue('--add')!, 10) : 0;
const APPEND = ADD_COUNT > 0;
const TARGET_COUNT = APPEND ? ADD_COUNT : language === 'he' ? HEBREW_COUNT : ENGLISH_COUNT;

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

/** Prefer fillable image lengths (5–8); keep the rest only when the preferred slice is thin. */
function rankCatalog(catalog: ImageClueCatalogEntry[]): ImageClueCatalogEntry[] {
  const lengthOf = (entry: ImageClueCatalogEntry) => normalizeWord(entry.answer).length;
  const preferred = catalog.filter((entry) => {
    const n = lengthOf(entry);
    return n >= 5 && n <= 8;
  });
  const rest = catalog.filter((entry) => {
    const n = lengthOf(entry);
    return n < 5 || n > 8;
  });
  return preferred.length >= 12 ? preferred : [...preferred, ...rest];
}

function meetsDailyTargets(puzzle: GeneratedPuzzle): boolean {
  const images = puzzle.puzzleItems.filter((item) => item.clueType === 'image').length;
  return dailyTargetMisses(scorePuzzle(puzzle), dailyTargetsFor(images, puzzle.grid)).length === 0;
}

function puzzleIsReady(puzzle: GeneratedPuzzle): boolean {
  const images = puzzle.puzzleItems.filter((item) => item.clueType === 'image');
  return (
    meetsDailyTargets(puzzle) &&
    images.length === IMAGE_COUNT &&
    puzzle.grid?.rows === GRID_SIZE &&
    puzzle.grid?.cols === GRID_SIZE &&
    getUncoveredCells(puzzle).length === 0 &&
    validatePuzzleBoundaries(puzzle).length === 0 &&
    images.every((item) => item.imageUrl && item.answer && /[\u0590-\u05FF]/.test(item.answer))
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

function rememberBoard(puzzle: GeneratedPuzzle, recent: RecentDailyContent): void {
  for (const item of puzzle.puzzleItems) {
    if (item.clueType === 'image') continue;
    if (item.answer) recent.answers.push(item.answer);
    if (item.clue) recent.clues.push(item.clue);
  }
  writeRecentDailyContent(RECENT_FILE, recent);
}

function loadExistingReady(): GeneratedPuzzle[] {
  if (!fs.existsSync(OUT_DIR)) return [];
  const files = fs
    .readdirSync(OUT_DIR)
    .filter((name) => /^mp-\d+\.json$/.test(name))
    .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));
  const puzzles: GeneratedPuzzle[] = [];
  for (const file of files) {
    try {
      const puzzle = JSON.parse(
        fs.readFileSync(path.join(OUT_DIR, file), 'utf8')
      ) as GeneratedPuzzle;
      if (puzzleIsReady(puzzle)) puzzles.push(puzzle);
    } catch {
      // skip
    }
  }
  return puzzles;
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
        '--catalog',
        CATALOG_FILE,
        '--index',
        String(index),
        '--size',
        String(GRID_SIZE),
        '--profile',
        'daily',
        '--recent',
        RECENT_FILE,
        '--category',
        MULTIPLAYER_CATEGORY,
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
  recent: RecentDailyContent,
  excludeFingerprints: Set<string>
): Promise<GeneratedPuzzle[]> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const puzzles: GeneratedPuzzle[] = [];
  const used = new Set<string>(excludeFingerprints);

  const takeIfNew = (puzzle: GeneratedPuzzle): boolean => {
    const fp = puzzleFingerprint(puzzle);
    if (used.has(fp)) return false;
    used.add(fp);
    puzzles.push(puzzle);
    rememberBoard(puzzle, recent);
    return true;
  };

  {
    const before = puzzles.length;
    for (const puzzle of loadExistingReady()) {
      if (puzzles.length >= count) break;
      takeIfNew(puzzle);
    }
    if (puzzles.length > before) {
      console.log(`♻️  Using ${puzzles.length - before} unique ready board(s) from ${OUT_DIR}`);
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
  const maxLaunches = Math.max(200, count * 16);

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

async function ensureMongoConnection(): Promise<void> {
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().command({ ping: 1 });
      return;
    }
  } catch {
    // reconnect below
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => undefined);
  }
  await connectToDatabase();
}

/** Drop Hebrew slots past the new pool and delete puzzles no longer assigned. */
async function retireReplacedHebrewPuzzles(
  previousIds: mongoose.Types.ObjectId[],
  keptIds: Set<string>,
  poolSize: number
): Promise<void> {
  const extra = await MultiplayerPuzzle.deleteMany({
    language: 'he',
    index: { $gte: poolSize },
  });
  if (extra.deletedCount > 0) {
    console.log(`   Removed ${extra.deletedCount} Hebrew slot(s) above index ${poolSize - 1}`);
  }

  const stale = previousIds.filter((id) => id && !keptIds.has(String(id)));
  if (stale.length === 0) return;

  const progress = await UserPuzzleProgress.deleteMany({ puzzleId: { $in: stale } });
  const stillDaily = await DailyPuzzle.find({ puzzleId: { $in: stale } }).select('puzzleId').lean();
  const dailyIds = new Set(stillDaily.map((row) => String(row.puzzleId)));
  const docs = await Puzzle.find({ _id: { $in: stale } }).select('_id packageId');
  const deletable = docs
    .filter((doc) => !doc.packageId && !dailyIds.has(String(doc._id)))
    .map((doc) => doc._id);
  const removed = deletable.length
    ? await Puzzle.deleteMany({ _id: { $in: deletable } })
    : { deletedCount: 0 };
  console.log(
    `   Retired ${removed.deletedCount} previous Hebrew multiplayer puzzle(s) ` +
      `(progress rows ${progress.deletedCount})`
  );
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
      const merged = mergeCatalogs(mongoCatalog, localCatalog);
      const catalog = rankCatalog(merged);
      if (catalog.length < IMAGE_COUNT) {
        throw new Error(
          `Need image clues, found ${catalog.length}. Run scripts/arrow-image-pipeline \`npm run process\` first.`
        );
      }
      fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog));
      const recent = await loadRecentDailyContent(14);
      writeRecentDailyContent(RECENT_FILE, recent);
      console.log(
        `Catalog ${catalog.length} (mongo ${mongoCatalog.length} + local ${localCatalog.length}; ` +
          `images already on dailies stay eligible)`
      );
      console.log(
        `Avoiding ${recent.answers.length} answers / ${recent.clues.length} clues from recent dailies`
      );
      console.log(
        APPEND
          ? `🎮 Adding ${TARGET_COUNT} Hebrew multiplayer puzzles from index ${startIndex}: ${GRID_SIZE}×${GRID_SIZE} with ${IMAGE_COUNT} images...\n`
          : `🎮 Generating ${TARGET_COUNT} Hebrew multiplayer puzzles: ${GRID_SIZE}×${GRID_SIZE} with ${IMAGE_COUNT} images...\n`
      );
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

      validPuzzles = await generateHebrewBatch(TARGET_COUNT, recent, excludeFingerprints);
    } else {
      console.log(
        `🎮 Generating ${TARGET_COUNT} English multiplayer puzzles: easy ${MULTIPLAYER_GRID_ROWS}x${MULTIPLAYER_GRID_COLS}...\n`
      );
      validPuzzles = await generateEnglishBatch(TARGET_COUNT);
    }

    if (validPuzzles.length < TARGET_COUNT) {
      console.error(`❌ Only generated ${validPuzzles.length}/${TARGET_COUNT} puzzles`);
      await closeDatabaseAndExit(1);
    }

    await ensureMongoConnection();

    console.log(`✅ Generated ${validPuzzles.length} valid puzzles\n`);

    const previousIds = existing.map((row) => row.puzzleId);
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

    if (language === 'he' && !APPEND) {
      await retireReplacedHebrewPuzzles(
        previousIds,
        new Set(savedPuzzles.map((puzzle) => String(puzzle._id))),
        startIndex + assignments.length
      );
    }

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
