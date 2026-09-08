/**
 * Generate 5 Hebrew image-clue puzzles (15→14→13, 2 images) and wire them as weekly picks.
 *
 * Spawns parallel workers because a large fill can take several minutes.
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
import { Difficulty } from '../types';
import { Puzzle as GeneratedPuzzle } from './core/types';
import {
  ImageClueCatalogEntry,
  loadGeneratedImageClueCatalog,
  loadImageClueCatalogFromMongo,
} from './generators/imageClueCatalog';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';
import { normalizeWord } from './generators/validation-utils';
import { FAV_PICK_ACCENTS } from '../utils/puzzlePreview';

const LANGUAGE = 'he' as const;
const TARGET = 5;
const WORKER_IMAGES = 2;
const WORKER_ATTEMPTS = 48;
const PARALLEL = 3;
const DIFFICULTIES: Difficulty[] = [
  Difficulty.EASY,
  Difficulty.MEDIUM,
  Difficulty.MEDIUM,
  Difficulty.HARD,
  Difficulty.HARD,
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

function runWorker(index: number, catalogPath: string, outPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(
      'npx',
      [
        'ts-node',
        'src/scripts/generateOneFav.ts',
        '--out',
        outPath,
        '--images',
        String(WORKER_IMAGES),
        '--attempts',
        String(WORKER_ATTEMPTS),
        '--catalog',
        catalogPath,
        '--index',
        String(index),
      ],
      { cwd: ROOT, stdio: 'inherit' }
    );
    child.on('exit', (code) => {
      if (code === 0 && fs.existsSync(outPath)) resolve(outPath);
      else resolve(null);
    });
    child.on('error', () => resolve(null));
  });
}

async function generateBatch(
  startIndex: number,
  count: number,
  catalogPath: string
): Promise<GeneratedPuzzle[]> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const puzzles: GeneratedPuzzle[] = [];
  for (let offset = 0; offset < count; offset += PARALLEL) {
    const chunk = Math.min(PARALLEL, count - offset);
    const jobs = Array.from({ length: chunk }, (_, i) => {
      const index = startIndex + offset + i;
      const outPath = path.join(OUT_DIR, `fav-${index}.json`);
      return runWorker(index, catalogPath, outPath);
    });
    const files = await Promise.all(jobs);
    for (const file of files) {
      if (!file) continue;
      puzzles.push(JSON.parse(fs.readFileSync(file, 'utf8')) as GeneratedPuzzle);
    }
  }
  return puzzles;
}

function takeUnique(puzzles: GeneratedPuzzle[], needed: number): GeneratedPuzzle[] {
  const taken: GeneratedPuzzle[] = [];
  const used = new Set<string>();
  for (const puzzle of puzzles) {
    if (taken.length >= needed) break;
    const answers = imageAnswers(puzzle);
    if (answers.some((answer) => used.has(answer))) continue;
    for (const answer of answers) used.add(answer);
    taken.push(puzzle);
  }
  return taken;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is required in .env');
    process.exit(1);
  }

  await connectToDatabase();
  console.log('Connected to', mongoose.connection.db?.databaseName);

  const mongoCatalog = await loadImageClueCatalogFromMongo();
  const localCatalog = loadGeneratedImageClueCatalog();
  const catalog = mergeCatalogs(mongoCatalog, localCatalog);
  if (catalog.length < 8) {
    throw new Error(
      `Need image clues, found ${catalog.length}. ` +
        `Run scripts/arrow-image-pipeline \`npm run process\` first.`
    );
  }
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog));
  console.log(`Catalog ${catalog.length} (mongo ${mongoCatalog.length} + local ${localCatalog.length})`);

  let collected: GeneratedPuzzle[] = [];
  let wave = 0;
  while (collected.length < TARGET && wave < 3) {
    wave += 1;
    const missing = TARGET - collected.length;
    console.log(`\n—— Wave ${wave}: generating ${missing} puzzle(s) in parallel ——`);
    const batch = await generateBatch(wave * 10, missing, CATALOG_FILE);
    collected = takeUnique([...collected, ...batch], TARGET);
    console.log(`   have ${collected.length}/${TARGET}`);
  }

  if (collected.length < TARGET) {
    throw new Error(`Only generated ${collected.length}/${TARGET} favorite puzzles`);
  }

  await connectToDatabase();
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
    const images = collected[i].puzzleItems.filter((item) => item.clueType === 'image').length;
    console.log(
      `   ${i + 1}. ${saved[i]._id} ${DIFFICULTIES[i]} ${saved[i].grid.rows}x${saved[i].grid.cols} images=${images} ${FAV_PICK_ACCENTS[i]}`
    );
  }

  await closeDatabaseAndExit(0);
}

main().catch(handleScriptError);
