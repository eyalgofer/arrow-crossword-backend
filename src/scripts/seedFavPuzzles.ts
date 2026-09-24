/**
 * Generate 4 fresh Hebrew favorites (14×14 or 15×15, 2–5 images) and wire them
 * as weekly picks. Excludes image answers already shown in dailies/favs/multiplayer.
 *
 * Usage:
 *   npm run seed:fav-puzzles
 *   npx ts-node src/scripts/seedFavPuzzles.ts --size 14 --images 2 --fresh
 *   npx ts-node src/scripts/seedFavPuzzles.ts --legacy   # old generator, difficulty is only a label
 *
 * Default is the daily profile (framed two-clue layout, scored fill). Each slot is generated
 * at its own difficulty — clue choice and word choice lean easy / medium / medium / hard.
 */

import dotenv from 'dotenv';
dotenv.config();

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Puzzle } from '../models/Puzzle';
import { FavPuzzle } from '../models/FavPuzzle';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { Difficulty } from '../types';
import { Puzzle as GeneratedPuzzle } from './core/types';
import {
  ImageClueCatalogEntry,
  loadGeneratedImageClueCatalog,
  loadImageClueCatalogFromMongo,
} from './generators/imageClueCatalog';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';
import { normalizeWord } from './generators/validation-utils';
import { getUncoveredCells } from './generators/direction-utils';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { FAV_PICK_ACCENTS } from '../utils/puzzlePreview';
import { dailyTargetMisses, dailyTargetsFor, scorePuzzle } from './generators/puzzle-quality';
import {
  RecentDailyContent,
  loadRecentDailyContent,
  writeRecentDailyContent,
} from './utils/recentDailyContent';

const LANGUAGE = 'he' as const;
const TARGET = 4;
const PARALLEL = 4;
const MAX_LAUNCHES = 64;
const DIFFICULTIES: Difficulty[] = [
  Difficulty.EASY,
  Difficulty.MEDIUM,
  Difficulty.MEDIUM,
  Difficulty.HARD,
];

/** Rotating presets — mostly 2 images for fill reliability; sprinkle 3–4. */
const LEGACY_PRESETS: Array<{ size: 14 | 15; images: number }> = [
  { size: 15, images: 2 },
  { size: 14, images: 2 },
  { size: 15, images: 2 },
  { size: 14, images: 2 },
  { size: 15, images: 3 },
  { size: 14, images: 3 },
  { size: 15, images: 2 },
  { size: 14, images: 4 },
];
/** Same boards as the dailies: framed layouts need room around 3×3 image blocks. */
const DAILY_PRESETS: Array<{ size: 14 | 15; images: number }> = [{ size: 14, images: 2 }];
const DEFAULT_PRESETS = process.argv.includes('--legacy') ? LEGACY_PRESETS : DAILY_PRESETS;

function argValue(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const FORCE_SIZE = argValue('--size') ? Number(argValue('--size')) : undefined;
const FORCE_IMAGES = argValue('--images') ? Number(argValue('--images')) : undefined;
const FALLBACK_PRESETS: Array<{ size: 14 | 15; images: number }> =
  FORCE_SIZE && FORCE_IMAGES
    ? [{ size: FORCE_SIZE as 14 | 15, images: FORCE_IMAGES }]
    : DEFAULT_PRESETS;
const STRICT_SIZE = FORCE_SIZE;
const STRICT_IMAGES = FORCE_IMAGES;
const FRESH = process.argv.includes('--fresh');
const LEGACY = process.argv.includes('--legacy');
const CATEGORY = 'כללי';
const WORKER_ATTEMPTS = FORCE_IMAGES === 2 ? 96 : 48;

const ROOT = path.join(__dirname, '../..');
const CATALOG_FILE = path.join(ROOT, 'tmp-fav-catalog.json');
const OUT_DIR = path.join(ROOT, 'tmp-fav-puzzles');
const RECENT_FILE = path.join(ROOT, 'tmp-fav-recent.json');

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

function imageAnswers(puzzle: GeneratedPuzzle): string[] {
  return puzzle.puzzleItems
    .filter((item) => item.clueType === 'image' && item.answer)
    .map((item) => normalizeWord(item.answer));
}

function meetsDailyTargets(puzzle: GeneratedPuzzle): boolean {
  if (LEGACY) return true;
  const images = puzzle.puzzleItems.filter((item) => item.clueType === 'image').length;
  return dailyTargetMisses(scorePuzzle(puzzle), dailyTargetsFor(images)).length === 0;
}

function puzzleIsReady(puzzle: GeneratedPuzzle, minImages: number, minSize: number): boolean {
  const images = puzzle.puzzleItems.filter((item) => item.clueType === 'image');
  return (
    meetsDailyTargets(puzzle) &&
    images.length >= minImages &&
    puzzle.grid?.rows >= minSize &&
    puzzle.grid?.cols >= minSize &&
    getUncoveredCells(puzzle).length === 0 &&
    validatePuzzleBoundaries(puzzle).length === 0 &&
    images.every((item) => item.imageUrl && item.answer && /[\u0590-\u05FF]/.test(item.answer))
  );
}

/** Exclude image answers already shown in Hebrew dailies or favorites. */
async function loadUsedImageAnswers(): Promise<Set<string>> {
  const [dailies, favs] = await Promise.all([
    DailyPuzzle.find({ language: LANGUAGE }).lean(),
    FavPuzzle.find({ language: LANGUAGE }).lean(),
  ]);

  const ids = [
    ...dailies.map((row) => row.puzzleId),
    ...favs.map((row) => row.puzzleId),
  ].filter(Boolean);

  const linked = ids.length
    ? await Puzzle.find({ _id: { $in: ids } }).lean()
    : [];

  const used = new Set<string>();
  for (const puzzle of linked) {
    for (const item of (puzzle as any).puzzleItems || []) {
      if (item.clueType === 'image' && item.answer) {
        used.add(normalizeWord(String(item.answer)));
      }
    }
  }
  return used;
}

function runWorker(
  index: number,
  catalogPath: string,
  outPath: string,
  size: number,
  images: number,
  difficulty: Difficulty
): Promise<GeneratedPuzzle | null> {
  return new Promise((resolve) => {
    const child = spawn(
      'npx',
      [
        'ts-node',
        'src/scripts/generateOneFav.ts',
        '--out',
        outPath,
        '--images',
        String(images),
        '--attempts',
        String(WORKER_ATTEMPTS),
        '--catalog',
        catalogPath,
        '--index',
        String(index),
        '--size',
        String(size),
        ...(LEGACY
          ? []
          : ['--profile', 'daily', '--recent', RECENT_FILE, '--difficulty', difficulty, '--category', CATEGORY]),
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
        resolve(puzzleIsReady(puzzle, images, size) ? puzzle : null);
      } catch {
        resolve(null);
      }
    });
    child.on('error', () => resolve(null));
  });
}

async function generateFavorites(
  catalogPath: string,
  baseCatalog: ImageClueCatalogEntry[],
  recent: RecentDailyContent
): Promise<GeneratedPuzzle[]> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const slots: Array<GeneratedPuzzle | null> = DIFFICULTIES.map(() => null);
  const inFlightBySlot = DIFFICULTIES.map(() => 0);
  const usedImages = new Set<string>();
  const filledCount = () => slots.filter(Boolean).length;

  /** Legacy boards fit any slot; daily-profile boards only a slot of their own difficulty. */
  const openSlotFor = (puzzle: GeneratedPuzzle, preferred?: number): number => {
    const fits = (i: number) => !slots[i] && (LEGACY || DIFFICULTIES[i] === puzzle.difficulty);
    if (preferred != null && fits(preferred)) return preferred;
    return DIFFICULTIES.findIndex((_, i) => fits(i));
  };

  const accept = (puzzle: GeneratedPuzzle, label: string, preferred?: number): boolean => {
    const answers = imageAnswers(puzzle);
    const minImages = STRICT_IMAGES ?? 2;
    if (answers.length < minImages) return false;
    if (
      STRICT_SIZE != null &&
      (puzzle.grid?.rows !== STRICT_SIZE || puzzle.grid?.cols !== STRICT_SIZE)
    ) {
      console.log(
        `♻️  Skipping ${label}: want ${STRICT_SIZE}x${STRICT_SIZE}, got ${puzzle.grid?.rows}x${puzzle.grid?.cols}`
      );
      return false;
    }
    const slot = openSlotFor(puzzle, preferred);
    if (slot === -1) {
      console.log(`♻️  Skipping ${label}: no open ${puzzle.difficulty} slot`);
      return false;
    }
    if (answers.some((answer) => usedImages.has(answer))) {
      console.log(`♻️  Skipping ${label}: image overlap with already-chosen favorites`);
      return false;
    }
    for (const answer of answers) usedImages.add(answer);
    slots[slot] = puzzle;
    for (const item of puzzle.puzzleItems) {
      if (item.clueType === 'image') continue;
      recent.answers.push(item.answer);
      recent.clues.push(item.clue);
    }
    writeRecentDailyContent(RECENT_FILE, recent);
    console.log(
      `✅ Have ${filledCount()}/${TARGET} — slot ${slot + 1} ${DIFFICULTIES[slot]} ` +
        `(${puzzle.grid.rows}x${puzzle.grid.cols}, images=${answers.length}: ${answers.join(', ')})`
    );
    // Keep later workers off already-chosen image answers.
    const remaining = baseCatalog.filter(
      (entry) => !usedImages.has(normalizeWord(entry.answer))
    );
    fs.writeFileSync(catalogPath, JSON.stringify(remaining));
    return true;
  };

  // Reuse unique ready boards from a prior partial run (unless --fresh).
  if (!FRESH && fs.existsSync(OUT_DIR)) {
    const files = fs
      .readdirSync(OUT_DIR)
      .filter((name) => /^fav-\d+\.json$/.test(name))
      .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));
    for (const file of files) {
      if (filledCount() >= TARGET) break;
      try {
        const puzzle = JSON.parse(
          fs.readFileSync(path.join(OUT_DIR, file), 'utf8')
        ) as GeneratedPuzzle;
        const minImgs = STRICT_IMAGES ?? 2;
        const minSize = STRICT_SIZE ?? 14;
        if (puzzleIsReady(puzzle, minImgs, minSize)) {
          accept(puzzle, file);
        }
      } catch {
        // skip bad file
      }
    }
  }

  if (filledCount() >= TARGET) {
    return slots as GeneratedPuzzle[];
  }

  let nextIndex =
    1 +
    (fs.existsSync(OUT_DIR)
      ? Math.max(
          0,
          ...fs
            .readdirSync(OUT_DIR)
            .map((name) => parseInt(name.replace(/\D/g, ''), 10))
            .filter((n) => Number.isFinite(n))
        )
      : 0);
  let inFlight = 0;
  let launched = 0;

  /** Open slot with the fewest workers on it, so every difficulty makes progress. */
  const nextSlot = (): number => {
    let best = -1;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i]) continue;
      if (best === -1 || inFlightBySlot[i] < inFlightBySlot[best]) best = i;
    }
    return best;
  };

  await new Promise<void>((resolve) => {
    const maybeDone = () => {
      if (filledCount() >= TARGET) {
        resolve();
        return;
      }
      if (inFlight === 0 && launched >= MAX_LAUNCHES) {
        resolve();
        return;
      }
      pump();
    };

    const pump = () => {
      while (filledCount() < TARGET && inFlight < PARALLEL && launched < MAX_LAUNCHES) {
        const slot = nextSlot();
        if (slot === -1) break;
        const index = nextIndex++;
        const preset = FALLBACK_PRESETS[launched % FALLBACK_PRESETS.length];
        const difficulty = DIFFICULTIES[slot];
        launched += 1;
        inFlight += 1;
        inFlightBySlot[slot] += 1;
        const outPath = path.join(OUT_DIR, `fav-${index}.json`);
        console.log(
          `—— Launch fav-${index}: slot ${slot + 1} ${difficulty}, ${preset.size}×${preset.size}, ` +
            `${preset.images} image(s) (in-flight ${inFlight}, have ${filledCount()}/${TARGET}) ——`
        );
        const done = (puzzle: GeneratedPuzzle | null) => {
          inFlight -= 1;
          inFlightBySlot[slot] -= 1;
          if (puzzle) accept(puzzle, `fav-${index}`, slot);
          maybeDone();
        };
        runWorker(index, catalogPath, outPath, preset.size, preset.images, difficulty)
          .then(done)
          .catch(() => done(null));
      }
      if (filledCount() >= TARGET || (inFlight === 0 && launched >= MAX_LAUNCHES)) {
        resolve();
      }
    };

    pump();
  });

  return slots.filter((puzzle): puzzle is GeneratedPuzzle => puzzle !== null);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is required in .env');
    process.exit(1);
  }

  await connectToDatabase();
  console.log('Connected to', mongoose.connection.db?.databaseName);

  const usedImages = await loadUsedImageAnswers();
  const mongoCatalog = await loadImageClueCatalogFromMongo();
  const localCatalog = loadGeneratedImageClueCatalog();
  const merged = mergeCatalogs(mongoCatalog, localCatalog);
  const available = merged.filter((entry) => !usedImages.has(normalizeWord(entry.answer)));
  const byLen = (entry: ImageClueCatalogEntry) => normalizeWord(entry.answer).length;
  const preferred = available.filter((entry) => {
    const n = byLen(entry);
    return n >= 5 && n <= 8;
  });
  const rest = available.filter((entry) => {
    const n = byLen(entry);
    return n < 5 || n > 8;
  });
  const needImages = TARGET * (STRICT_IMAGES ?? 2);
  const catalog =
    preferred.length >= Math.max(12, needImages)
      ? preferred
      : [...preferred, ...rest];

  if (catalog.length < needImages) {
    throw new Error(
      `Need unused image clues, found ${catalog.length} after excluding ${usedImages.size} previously shown. ` +
        `Run scripts/arrow-image-pipeline \`npm run process\` first.`
    );
  }

  if (FRESH && fs.existsSync(OUT_DIR)) {
    for (const name of fs.readdirSync(OUT_DIR)) {
      if (/^fav-\d+\.json$/.test(name)) {
        fs.unlinkSync(path.join(OUT_DIR, name));
      }
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog));
  const sizeLabel = STRICT_SIZE ?? '14/15';
  const imagesLabel = STRICT_IMAGES ?? '2–5';
  console.log(
    `Catalog ${catalog.length} available ` +
      `(excluded ${usedImages.size} previously shown; mongo ${mongoCatalog.length} + local ${localCatalog.length})`
  );
  console.log(
    `Targeting ${TARGET} favorites: ${sizeLabel}×${sizeLabel}, ${imagesLabel} image(s)\n`
  );

  const recent = await loadRecentDailyContent(14);
  writeRecentDailyContent(RECENT_FILE, recent);
  const collected = await generateFavorites(CATALOG_FILE, catalog, recent);
  if (collected.length < TARGET) {
    throw new Error(`Only generated ${collected.length}/${TARGET} favorite puzzles`);
  }

  const previous = await FavPuzzle.find({ language: LANGUAGE }).lean();
  const previousIds = previous.map((row) => row.puzzleId).filter(Boolean);

  await FavPuzzle.deleteMany({ language: LANGUAGE });

  const saved = await Puzzle.insertMany(
    collected.map((puzzle, index) => ({
      title: `#${index + 1}`,
      difficulty: DIFFICULTIES[index],
      category: puzzle.category,
      language: LANGUAGE,
      grid: puzzle.grid,
      puzzleItems: puzzle.puzzleItems,
      estimatedTime: puzzle.estimatedTime ?? 30,
      coinReward: puzzle.coinReward ?? 50,
      isActive: true,
    }))
  );

  await FavPuzzle.insertMany(
    saved.map((doc, index) => ({
      puzzleId: doc._id,
      order: index,
      language: LANGUAGE,
      accent: FAV_PICK_ACCENTS[index % FAV_PICK_ACCENTS.length],
      isActive: true,
    }))
  );

  if (previousIds.length) {
    await Puzzle.deleteMany({
      _id: { $in: previousIds },
      packageId: { $exists: false },
    });
  }

  console.log(`\n✅ Wired ${saved.length} puzzles to fav_puzzles (replaced ${previousIds.length})`);
  for (let i = 0; i < saved.length; i++) {
    const images = collected[i].puzzleItems.filter((item) => item.clueType === 'image');
    const answers = images.map((item) => item.answer).join(', ');
    console.log(
      `   ${i + 1}. ${saved[i]._id} ${DIFFICULTIES[i]} ${saved[i].grid.rows}x${saved[i].grid.cols} ` +
        `images=${images.length} [${answers}] ${FAV_PICK_ACCENTS[i]}`
    );
  }

  await closeDatabaseAndExit(0);
}

main().catch(handleScriptError);
