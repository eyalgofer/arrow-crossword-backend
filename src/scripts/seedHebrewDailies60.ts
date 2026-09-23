/**
 * Generate Hebrew daily puzzles (14×14 or 15×15, 2–5 images) and assign them
 * for N consecutive days. Excludes image answers already used this week.
 *
 * Usage:
 *   npx ts-node src/scripts/seedHebrewDailies60.ts --count 14 --start 2026-09-16
 *   npx ts-node src/scripts/seedHebrewDailies60.ts --count 7 --from-tomorrow
 *   npx ts-node src/scripts/seedHebrewDailies60.ts --count 7 --from-tomorrow --size 14 --images 2 --fresh
 *   npx ts-node src/scripts/seedHebrewDailies60.ts --count 7 --from-tomorrow --legacy   # old generator
 *
 * Default is the daily profile: framed two-clue layout, scored fill, answers/clues from the
 * last 14 days avoided, and every board must meet the daily audit targets.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Puzzle } from '../models/Puzzle';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { FavPuzzle } from '../models/FavPuzzle';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { assignPuzzleToDate, getDayOfYear } from '../utils/dailyPuzzleUtils';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';
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

dotenv.config();

const CATEGORY = 'יומי';
const LANGUAGE = 'he' as const;
const PARALLEL = 4;
const ROOT = path.join(__dirname, '../..');
const CATALOG_FILE = path.join(ROOT, 'tmp-daily-catalog.json');
const OUT_DIR = path.join(ROOT, 'tmp-daily-puzzles');
const RECENT_FILE = path.join(ROOT, 'tmp-daily-recent.json');
const LEGACY = process.argv.includes('--legacy');

/** Rotating presets — mostly 2 images for fill reliability; sprinkle 3–5. */
const LEGACY_PRESETS: Array<{ size: 14 | 15; images: number }> = [
  { size: 14, images: 2 },
  { size: 14, images: 3 },
  { size: 14, images: 2 },
  { size: 14, images: 4 },
  { size: 14, images: 2 },
  { size: 14, images: 3 },
];
/** Framed layouts need room around 3×3 image blocks: 3 images only on 15×15. */
const DAILY_PRESETS: Array<{ size: 14 | 15; images: number }> = [
  { size: 14, images: 2 },
  { size: 14, images: 2 },
  { size: 15, images: 3 },
];
const DEFAULT_PRESETS = LEGACY ? LEGACY_PRESETS : DAILY_PRESETS;

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
/** When --size/--images set, accept only exact matches; otherwise allow mixed presets. */
const STRICT_SIZE = FORCE_SIZE;
const STRICT_IMAGES = FORCE_IMAGES;
const TARGET_SIZE = FORCE_SIZE ?? 14;
const TARGET_IMAGES = FORCE_IMAGES ?? 2;
const FRESH = process.argv.includes('--fresh');
const WORKER_ATTEMPTS = FORCE_IMAGES === 2 ? 96 : 48;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function parseStartDate(): Date {
  if (process.argv.includes('--from-tomorrow')) {
    return addDays(new Date(), 1);
  }
  const raw = argValue('--start');
  if (raw) {
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new Error(`Invalid --start ${raw}; use YYYY-MM-DD`);
    }
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      0,
      0,
      0,
      0
    );
    return date;
  }
  return addDays(new Date(), 0);
}

function defaultCount(): number {
  const start = addDays(new Date(), 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

const COUNT = argValue('--count') ? Number(argValue('--count')) : defaultCount();
const MAX_LAUNCHES = Math.max(200, COUNT * 16);

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

/** Exclude image answers already shown in any Hebrew daily or favorite. */
async function loadUsedImageAnswers(): Promise<Set<string>> {
  const [dailies, favs] = await Promise.all([
    DailyPuzzle.find({ language: LANGUAGE }).lean(),
    FavPuzzle.find({ language: LANGUAGE }).lean(),
  ]);

  const ids = [
    ...dailies.map((row) => row.puzzleId),
    ...favs.map((row) => row.puzzleId),
  ].filter(Boolean);

  const linked = ids.length ? await Puzzle.find({ _id: { $in: ids } }).lean() : [];

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

async function replaceDailyAssignment(
  newPuzzleId: mongoose.Types.ObjectId,
  date: Date
): Promise<void> {
  const normalized = addDays(date, 0);
  const year = normalized.getFullYear();
  const dayOfYear = getDayOfYear(normalized);
  const existing = await DailyPuzzle.findOne({ dayOfYear, year, language: LANGUAGE });
  const oldId = existing?.puzzleId;

  await assignPuzzleToDate(newPuzzleId, normalized);

  if (oldId && String(oldId) !== String(newPuzzleId)) {
    await UserPuzzleProgress.deleteMany({ puzzleId: oldId });
    const oldPuzzle = await Puzzle.findById(oldId);
    if (oldPuzzle && !oldPuzzle.packageId) {
      await Puzzle.deleteOne({ _id: oldId });
    }
  }
}

function runWorker(
  index: number,
  catalogPath: string,
  outPath: string,
  size: number,
  images: number
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
        ...(LEGACY ? [] : ['--profile', 'daily', '--recent', RECENT_FILE]),
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

async function generateDailies(
  catalogPath: string,
  baseCatalog: ImageClueCatalogEntry[],
  target: number,
  recent: RecentDailyContent
): Promise<GeneratedPuzzle[]> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const collected: GeneratedPuzzle[] = [];
  const usedImages = new Set<string>();

  const accept = (puzzle: GeneratedPuzzle, label: string): boolean => {
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
    if (answers.some((answer) => usedImages.has(answer))) {
      console.log(`♻️  Skipping ${label}: image overlap with already-chosen dailies`);
      return false;
    }
    for (const answer of answers) usedImages.add(answer);
    collected.push(puzzle);
    for (const item of puzzle.puzzleItems) {
      if (item.clueType === 'image') continue;
      recent.answers.push(item.answer);
      recent.clues.push(item.clue);
    }
    writeRecentDailyContent(RECENT_FILE, recent);
    console.log(
      `✅ Have ${collected.length}/${target} ` +
        `(${puzzle.grid.rows}x${puzzle.grid.cols}, images=${answers.length}: ${answers.join(', ')})`
    );
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
      .filter((name) => /^daily-\d+\.json$/.test(name))
      .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));
    for (const file of files) {
      if (collected.length >= target) break;
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

  if (collected.length >= target) {
    return collected.slice(0, target);
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

  await new Promise<void>((resolve) => {
    const maybeDone = () => {
      if (collected.length >= target) {
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
      while (collected.length < target && inFlight < PARALLEL && launched < MAX_LAUNCHES) {
        const index = nextIndex++;
        const preset = FALLBACK_PRESETS[launched % FALLBACK_PRESETS.length];
        launched += 1;
        inFlight += 1;
        const outPath = path.join(OUT_DIR, `daily-${index}.json`);
        console.log(
          `—— Launch daily-${index}: ${preset.size}×${preset.size}, ${preset.images} image(s) ` +
            `(in-flight ${inFlight}, have ${collected.length}/${target}) ——`
        );
        runWorker(index, catalogPath, outPath, preset.size, preset.images)
          .then((puzzle) => {
            inFlight -= 1;
            if (puzzle) accept(puzzle, `daily-${index}`);
            maybeDone();
          })
          .catch(() => {
            inFlight -= 1;
            maybeDone();
          });
      }
      if (collected.length >= target || (inFlight === 0 && launched >= MAX_LAUNCHES)) {
        resolve();
      }
    };

    pump();
  });

  return collected.slice(0, target);
}

const main = async () => {
  try {
    if (!Number.isFinite(COUNT) || COUNT <= 0) {
      throw new Error(`Invalid --count ${COUNT}`);
    }

    await connectToDatabase();

    const startDay = parseStartDate();
    const lastDay = addDays(startDay, COUNT - 1);

    const usedImages = await loadUsedImageAnswers();
    const mongoCatalog = await loadImageClueCatalogFromMongo();
    const localCatalog = loadGeneratedImageClueCatalog();
    const merged = mergeCatalogs(mongoCatalog, localCatalog);
    const available = merged.filter((entry) => !usedImages.has(normalizeWord(entry.answer)));
    // Prefer fillable image lengths (5–8). Keep longer ones only as last resort.
    const byLen = (entry: ImageClueCatalogEntry) => normalizeWord(entry.answer).length;
    const preferred = available.filter((entry) => {
      const n = byLen(entry);
      return n >= 5 && n <= 8;
    });
    const rest = available.filter((entry) => {
      const n = byLen(entry);
      return n < 5 || n > 8;
    });
    const needImages = COUNT * TARGET_IMAGES;
    const catalog =
      preferred.length >= Math.max(12, needImages - 8)
        ? preferred
        : [...preferred, ...rest];

    if (preferred.length < needImages) {
      console.warn(
        `⚠️  Only ${preferred.length} catalog entries with length 5–8 after exclude ` +
          `(need ~${needImages} image slots). Fill rate may be lower.`
      );
    }
    if (catalog.length < needImages) {
      throw new Error(
        `Need unused image clues, found ${catalog.length} after excluding ${usedImages.size} previously shown. ` +
          `Run scripts/arrow-image-pipeline \`npm run process\` first.`
      );
    }

    if (FRESH && fs.existsSync(OUT_DIR)) {
      for (const name of fs.readdirSync(OUT_DIR)) {
        if (/^daily-\d+\.json$/.test(name)) {
          fs.unlinkSync(path.join(OUT_DIR, name));
        }
      }
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog));

    console.log(
      `Catalog ${catalog.length} available ` +
        `(excluded ${usedImages.size} previously shown; mongo ${mongoCatalog.length} + local ${localCatalog.length})`
    );
    console.log(
      `📅 Generating ${COUNT} Hebrew dailies: ${TARGET_SIZE}×${TARGET_SIZE}, ${TARGET_IMAGES} image(s), ` +
        `${startDay.toLocaleDateString()} → ${lastDay.toLocaleDateString()}\n`
    );

    const recent = await loadRecentDailyContent(14);
    writeRecentDailyContent(RECENT_FILE, recent);
    console.log(
      `Avoiding ${recent.answers.length} answers / ${recent.clues.length} clues from recent dailies` +
        (LEGACY ? ' (ignored by --legacy)' : '')
    );

    const generated = await generateDailies(CATALOG_FILE, catalog, COUNT, recent);
    if (generated.length < COUNT) {
      throw new Error(`Only generated ${generated.length}/${COUNT} daily puzzles`);
    }

    await ensureMongoConnection();
    const savedIds: string[] = [];

    for (let i = 0; i < generated.length; i++) {
      const date = addDays(startDay, i);
      const puzzle = {
        ...generated[i],
        title: `תשחץ יומי ${i + 1}`,
        category: CATEGORY,
        language: LANGUAGE,
      };
      const inserted = await Puzzle.insertMany([puzzle]);
      const saved = inserted[0];
      await replaceDailyAssignment(saved._id as mongoose.Types.ObjectId, date);
      savedIds.push(String(saved._id));
      const images = saved.puzzleItems.filter((item) => item.clueType === 'image');
      const answers = images.map((item) => item.answer).join(', ');
      console.log(
        `   ${date.toISOString().slice(0, 10)} → ${saved.title} ` +
          `${saved.grid.rows}x${saved.grid.cols} images=${images.length} [${answers}]`
      );
    }

    console.log(`\n✅ Assigned ${savedIds.length}/${COUNT} Hebrew dailies`);
    console.log(`📊 Total daily assignments: ${await DailyPuzzle.countDocuments()}`);
    await closeDatabaseAndExit(savedIds.length === COUNT ? 0 : 1);
  } catch (error) {
    await handleScriptError(error);
  }
};

main();
