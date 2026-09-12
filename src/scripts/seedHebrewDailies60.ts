/**
 * Generate Hebrew 15×15 daily puzzles with 2 image clues and assign them
 * from today for N days (default: ~3 months, or --count).
 *
 * Usage:
 *   npx ts-node src/scripts/seedHebrewDailies60.ts --count 20
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Puzzle } from '../models/Puzzle';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { assignPuzzleToDate, getDayOfYear } from '../utils/dailyPuzzleUtils';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';
import {
  loadGeneratedImageClueCatalog,
  loadImageClueCatalogFromMongo,
} from './generators/imageClueCatalog';
import { Puzzle as GeneratedPuzzle } from './core/types';
import { normalizeWord } from './generators/validation-utils';
import { getUncoveredCells } from './generators/direction-utils';

dotenv.config();

const countArgIndex = process.argv.indexOf('--count');
const CATEGORY = 'יומי';
const LANGUAGE = 'he' as const;
const IMAGE_COUNT = 2;
const ATTEMPTS = 40;
const PARALLEL = 4;
const ROOT = path.join(__dirname, '../..');
const CATALOG_FILE = path.join(ROOT, 'tmp-daily-catalog.json');
const OUT_DIR = path.join(ROOT, 'tmp-daily-puzzles');

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function defaultCount(): number {
  const start = addDays(new Date(), 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

const COUNT = countArgIndex !== -1 ? Number(process.argv[countArgIndex + 1]) : defaultCount();

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

function runWorker(index: number): Promise<GeneratedPuzzle | null> {
  return new Promise((resolve) => {
    const outPath = path.join(OUT_DIR, `daily-${index}.json`);
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

function loadExistingReady(): GeneratedPuzzle[] {
  if (!fs.existsSync(OUT_DIR)) return [];
  const files = fs
    .readdirSync(OUT_DIR)
    .filter((name) => /^daily-\d+\.json$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10);
      const nb = parseInt(b.replace(/\D/g, ''), 10);
      return na - nb;
    });
  const puzzles: GeneratedPuzzle[] = [];
  for (const file of files) {
    try {
      const puzzle = JSON.parse(
        fs.readFileSync(path.join(OUT_DIR, file), 'utf8')
      ) as GeneratedPuzzle;
      if (puzzleIsReady(puzzle)) puzzles.push(puzzle);
    } catch {
      // skip bad files
    }
  }
  return puzzles;
}

async function generateAll(count: number): Promise<GeneratedPuzzle[]> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const puzzles = loadExistingReady();
  if (puzzles.length > 0) {
    console.log(`♻️  Reusing ${puzzles.length} existing ready 15×15 daily puzzle(s) from ${OUT_DIR}`);
  }
  const existingIds = fs
    .readdirSync(OUT_DIR)
    .map((name) => parseInt(name.replace(/\D/g, ''), 10))
    .filter((n) => Number.isFinite(n));
  let nextIndex = 1 + (existingIds.length ? Math.max(...existingIds) : 0);
  let waves = 0;
  while (puzzles.length < count) {
    waves += 1;
    const missing = count - puzzles.length;
    const chunk = Math.min(PARALLEL, missing);
    console.log(`\n—— Generating ${chunk} daily puzzle(s) in parallel (have ${puzzles.length}/${count}) ——`);
    const batch = await Promise.all(
      Array.from({ length: chunk }, (_, i) => runWorker(nextIndex + i))
    );
    nextIndex += chunk;
    let gained = 0;
    for (const puzzle of batch) {
      if (puzzle) {
        puzzles.push(puzzle);
        gained += 1;
      }
    }
    // Stop after several dry waves so we don't spin forever.
    if (gained === 0 && waves >= 8) break;
    if (waves >= 16) break;
  }
  return puzzles.slice(0, count);
}

const main = async () => {
  try {
    await connectToDatabase();

    const mongoCatalog = await loadImageClueCatalogFromMongo();
    const localCatalog = loadGeneratedImageClueCatalog();
    const byAnswer = new Map(mongoCatalog.map((entry) => [normalizeWord(entry.answer), entry]));
    for (const entry of localCatalog) {
      if (entry.answer && entry.imageUrl) byAnswer.set(normalizeWord(entry.answer), entry);
    }
    const catalog = [...byAnswer.values()];
    if (catalog.length < IMAGE_COUNT) {
      throw new Error(
        `Need image clues, found ${catalog.length}. Run scripts/arrow-image-pipeline \`npm run process\` first.`
      );
    }
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog));

    const startDay = addDays(new Date(), 0);
    const lastDay = addDays(startDay, COUNT - 1);
    console.log(
      `📅 Generating ${COUNT} Hebrew 15×15 dailies (2 images) ` +
        `${startDay.toLocaleDateString()} → ${lastDay.toLocaleDateString()}\n`
    );

    const generated = await generateAll(COUNT);
    if (generated.length < COUNT) {
      console.warn(`⚠️  Only generated ${generated.length}/${COUNT} puzzles`);
    }

    await ensureMongoConnection();
    const savedIds: string[] = [];

    for (let i = 0; i < generated.length; i++) {
      const date = addDays(startDay, i);
      const puzzle = { ...generated[i], title: `תשחץ יומי ${i + 1}`, category: CATEGORY };
      const inserted = await Puzzle.insertMany([puzzle]);
      const saved = inserted[0];
      await replaceDailyAssignment(saved._id as mongoose.Types.ObjectId, date);
      savedIds.push(String(saved._id));
      const images = saved.puzzleItems.filter((item) => item.clueType === 'image').length;
      console.log(
        `   ${date.toLocaleDateString()} → ${saved.title} ` +
          `(${saved.grid.rows}x${saved.grid.cols}, ${saved.puzzleItems.length} clues, ${images} images)`
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
