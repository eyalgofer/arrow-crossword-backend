/**
 * Generate 4 fresh Hebrew favorites (14×14 or 15×15, 2–5 images) and wire them
 * as weekly picks. Excludes image answers already used this week.
 *
 * Usage:
 *   npm run seed:fav-puzzles
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
import { MultiplayerPuzzle } from '../models/MultiplayerPuzzle';
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

const LANGUAGE = 'he' as const;
const TARGET = 4;
const PARALLEL = 4;
const WORKER_ATTEMPTS = 48;
const MAX_LAUNCHES = 48;
const DIFFICULTIES: Difficulty[] = [
  Difficulty.EASY,
  Difficulty.MEDIUM,
  Difficulty.MEDIUM,
  Difficulty.HARD,
];

/** Rotating presets — mostly 2 images for fill reliability; sprinkle 3–4. */
const FALLBACK_PRESETS: Array<{ size: 14 | 15; images: number }> = [
  { size: 15, images: 2 },
  { size: 14, images: 2 },
  { size: 15, images: 2 },
  { size: 14, images: 2 },
  { size: 15, images: 3 },
  { size: 14, images: 3 },
  { size: 15, images: 2 },
  { size: 14, images: 4 },
];

const ROOT = path.join(__dirname, '../..');
const CATALOG_FILE = path.join(ROOT, 'tmp-fav-catalog.json');
const OUT_DIR = path.join(ROOT, 'tmp-fav-puzzles');

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

function puzzleIsReady(puzzle: GeneratedPuzzle, minImages: number, minSize: number): boolean {
  const images = puzzle.puzzleItems.filter((item) => item.clueType === 'image');
  return (
    images.length >= minImages &&
    puzzle.grid?.rows >= minSize &&
    puzzle.grid?.cols >= minSize &&
    getUncoveredCells(puzzle).length === 0 &&
    validatePuzzleBoundaries(puzzle).length === 0 &&
    images.every((item) => item.imageUrl && item.answer && /[\u0590-\u05FF]/.test(item.answer))
  );
}

async function loadUsedImageAnswersThisWeek(): Promise<Set<string>> {
  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);

  const [dailies, favs, mps, recent] = await Promise.all([
    DailyPuzzle.find({ language: LANGUAGE, date: { $gte: weekAgo } }).lean(),
    FavPuzzle.find({ language: LANGUAGE }).lean(),
    MultiplayerPuzzle.find({ language: LANGUAGE }).lean(),
    Puzzle.find({ language: LANGUAGE, createdAt: { $gte: weekAgo } }).lean(),
  ]);

  const ids = [
    ...dailies.map((row) => row.puzzleId),
    ...favs.map((row) => row.puzzleId),
    ...mps.map((row) => row.puzzleId),
  ].filter(Boolean);

  const linked = ids.length
    ? await Puzzle.find({ _id: { $in: ids } }).lean()
    : [];

  const used = new Set<string>();
  for (const puzzle of [...linked, ...recent]) {
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
  baseCatalog: ImageClueCatalogEntry[]
): Promise<GeneratedPuzzle[]> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const collected: GeneratedPuzzle[] = [];
  const usedImages = new Set<string>();

  const accept = (puzzle: GeneratedPuzzle, label: string): boolean => {
    const answers = imageAnswers(puzzle);
    if (answers.length < 2) return false;
    if (answers.some((answer) => usedImages.has(answer))) {
      console.log(`♻️  Skipping ${label}: image overlap with already-chosen favorites`);
      return false;
    }
    for (const answer of answers) usedImages.add(answer);
    collected.push(puzzle);
    console.log(
      `✅ Have ${collected.length}/${TARGET} ` +
        `(${puzzle.grid.rows}x${puzzle.grid.cols}, images=${answers.length}: ${answers.join(', ')})`
    );
    // Keep later workers off already-chosen image answers.
    const remaining = baseCatalog.filter(
      (entry) => !usedImages.has(normalizeWord(entry.answer))
    );
    fs.writeFileSync(catalogPath, JSON.stringify(remaining));
    return true;
  };

  // Reuse unique ready boards from a prior partial run.
  if (fs.existsSync(OUT_DIR)) {
    const files = fs
      .readdirSync(OUT_DIR)
      .filter((name) => /^fav-\d+\.json$/.test(name))
      .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));
    for (const file of files) {
      if (collected.length >= TARGET) break;
      try {
        const puzzle = JSON.parse(
          fs.readFileSync(path.join(OUT_DIR, file), 'utf8')
        ) as GeneratedPuzzle;
        const images = puzzle.puzzleItems.filter((item) => item.clueType === 'image').length;
        const size = Math.min(puzzle.grid?.rows ?? 0, puzzle.grid?.cols ?? 0);
        if (puzzleIsReady(puzzle, Math.min(2, images), Math.min(14, size))) {
          accept(puzzle, file);
        }
      } catch {
        // skip bad file
      }
    }
  }

  if (collected.length >= TARGET) {
    return collected.slice(0, TARGET);
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
      if (collected.length >= TARGET) {
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
      while (
        collected.length < TARGET &&
        inFlight < PARALLEL &&
        launched < MAX_LAUNCHES
      ) {
        const index = nextIndex++;
        // Prefer easier fillable boards; rotate size/image counts for variety.
        const preset = FALLBACK_PRESETS[launched % FALLBACK_PRESETS.length];
        launched += 1;
        inFlight += 1;
        const outPath = path.join(OUT_DIR, `fav-${index}.json`);
        console.log(
          `—— Launch fav-${index}: ${preset.size}×${preset.size}, ${preset.images} image(s) ` +
            `(in-flight ${inFlight}, have ${collected.length}/${TARGET}) ——`
        );
        runWorker(index, catalogPath, outPath, preset.size, preset.images)
          .then((puzzle) => {
            inFlight -= 1;
            if (puzzle) accept(puzzle, `fav-${index}`);
            maybeDone();
          })
          .catch(() => {
            inFlight -= 1;
            maybeDone();
          });
      }
      if (collected.length >= TARGET || (inFlight === 0 && launched >= MAX_LAUNCHES)) {
        resolve();
      }
    };

    pump();
  });

  return collected.slice(0, TARGET);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is required in .env');
    process.exit(1);
  }

  await connectToDatabase();
  console.log('Connected to', mongoose.connection.db?.databaseName);

  const usedThisWeek = await loadUsedImageAnswersThisWeek();
  const mongoCatalog = await loadImageClueCatalogFromMongo();
  const localCatalog = loadGeneratedImageClueCatalog();
  const merged = mergeCatalogs(mongoCatalog, localCatalog);
  const catalog = merged.filter((entry) => !usedThisWeek.has(normalizeWord(entry.answer)));

  if (catalog.length < 12) {
    throw new Error(
      `Need unused image clues, found ${catalog.length} after excluding ${usedThisWeek.size} used this week. ` +
        `Run scripts/arrow-image-pipeline \`npm run process\` first.`
    );
  }

  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog));
  console.log(
    `Catalog ${catalog.length} available ` +
      `(excluded ${usedThisWeek.size} used this week; mongo ${mongoCatalog.length} + local ${localCatalog.length})`
  );
  console.log(
    `Targeting ${TARGET} favorites: sizes 14/15, images 2–5, avoiding this week's image answers\n`
  );

  const collected = await generateFavorites(CATALOG_FILE, catalog);
  if (collected.length < TARGET) {
    throw new Error(`Only generated ${collected.length}/${TARGET} favorite puzzles`);
  }

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

  console.log(`\n✅ Wired ${saved.length} puzzles to fav_puzzles`);
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
