/**
 * Replace Hebrew package 1 puzzle #9 with a dense image-clue תשחץ.
 *
 * Usage:
 *   npm run seed:image-clues
 *
 * Uses tmp-image-clue-puzzle.json if present, otherwise generates fresh.
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Puzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { Difficulty } from '../types';
import { Puzzle as GeneratedPuzzle } from './core/types';
import { generateLargestImageCluePuzzle } from './generators/puzzlesGenerator';
import { loadImageClueCatalogFromMongo } from './generators/imageClueCatalog';
import { getUncoveredCells } from './generators/direction-utils';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { connectToDatabase } from './utils/scriptUtils';

const PACKAGE_ORDER = 0;
const PUZZLE_TITLE = '#9';
const MIN_IMAGE_CLUES = 4;
const CACHED = path.join(__dirname, '../../tmp-image-clue-puzzle.json');

function directionMixLooksNatural(puzzle: GeneratedPuzzle): boolean {
  const horizontal = new Set(['across', 'down-across', 'up-across']);
  let h = 0;
  let v = 0;
  const kinds = new Set<string>();
  for (const item of puzzle.puzzleItems) {
    kinds.add(item.direction);
    if (horizontal.has(item.direction)) h += 1;
    else v += 1;
  }
  const total = h + v;
  return total > 0 && h / total >= 0.32 && v / total >= 0.32 && kinds.size >= 2;
}

function cachedPuzzleIsReady(): GeneratedPuzzle | null {
  if (!fs.existsSync(CACHED)) return null;
  const cached = JSON.parse(fs.readFileSync(CACHED, 'utf8')) as GeneratedPuzzle;
  const images = cached.puzzleItems.filter((item) => item.clueType === 'image');
  const ready =
    images.length >= MIN_IMAGE_CLUES &&
    cached.grid?.rows === 16 &&
    cached.grid?.cols === 16 &&
    getUncoveredCells(cached).length === 0 &&
    directionMixLooksNatural(cached) &&
    images.every(
      (item) =>
        item.imageUrl &&
        item.answer &&
        /[\u0590-\u05FF]/.test(item.answer) &&
        !item.imageUrl.includes('premierpups')
    );
  return ready ? cached : null;
}

async function generateFresh(): Promise<GeneratedPuzzle> {
  await connectToDatabase();
  const catalog = await loadImageClueCatalogFromMongo();
  if (catalog.length < MIN_IMAGE_CLUES) {
    throw new Error(
      `Need image clues in Mongo, found ${catalog.length}. ` +
        `Run scripts/arrow-image-pipeline \`npm run process\` first.`
    );
  }
  console.log(
    `Generating 16x16 mixed-arrow תשחץ with 4 image clues (catalog ${catalog.length})...`
  );
  const puzzle = generateLargestImageCluePuzzle({
    category: 'כללי',
    startIndex: 9,
    imageClueCount: 4,
    imageClueCatalog: catalog,
  });
  if (!puzzle) {
    throw new Error('Failed to generate Hebrew image-clue puzzle');
  }
  fs.writeFileSync(CACHED, JSON.stringify(puzzle, null, 2));
  console.log('Cached to', CACHED);
  return puzzle;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is required in .env');
    process.exit(1);
  }

  const generated = cachedPuzzleIsReady();
  if (generated) {
    console.log('Loading cached puzzle from', CACHED);
  }
  const puzzle = generated ?? (await generateFresh());
  const boundaryErrors = validatePuzzleBoundaries(puzzle);
  if (boundaryErrors.length > 0) {
    throw new Error(`Boundary validation failed:\n${boundaryErrors.join('\n')}`);
  }

  const imageItems = puzzle.puzzleItems.filter((i) => i.clueType === 'image');
  if (imageItems.length < MIN_IMAGE_CLUES) {
    throw new Error(
      `Expected at least ${MIN_IMAGE_CLUES} image clue, got ${imageItems.length}`
    );
  }

  if (mongoose.connection.readyState !== 1) {
    await connectToDatabase();
  }
  console.log('Connected to', mongoose.connection.db?.databaseName);

  let pkg = await PuzzlePackage.findOne({ language: 'he', order: PACKAGE_ORDER });
  if (!pkg) {
    const all = await PuzzlePackage.find({ language: 'he' }).sort({ order: 1 }).lean();
    console.log(
      'Hebrew packages:',
      all.map((p) => `order=${p.order} "${p.name}" (${p.puzzleIds?.length})`).join(', ') || '(none)'
    );
    // Fallback: first Hebrew package by order
    pkg = await PuzzlePackage.findOne({ language: 'he' }).sort({ order: 1 });
  }
  if (!pkg) {
    throw new Error('No Hebrew packages found in this database');
  }
  console.log(`Package: ${pkg.name} order=${pkg.order} (${pkg._id}) — ${pkg.puzzleIds.length} puzzles`);

  let target = await Puzzle.findOne({
    packageId: pkg._id,
    title: PUZZLE_TITLE,
    language: 'he',
  });
  if (!target) {
    const id = pkg.puzzleIds[8];
    if (!id) throw new Error('No puzzle at package slot 9');
    target = await Puzzle.findById(id);
    if (!target) throw new Error(`Puzzle ${id} missing`);
    console.log(`Using slot 9 by index (title was "${target.title}")`);
  }

  console.log(
    `Replacing ${target.title} (${target._id}) ` +
      `${target.grid.rows}x${target.grid.cols} → ${puzzle.grid.rows}x${puzzle.grid.cols}`
  );

  await UserPuzzleProgress.deleteMany({ puzzleId: target._id });

  target.title = PUZZLE_TITLE;
  target.difficulty = Difficulty.MEDIUM;
  target.category = puzzle.category;
  target.language = 'he';
  target.grid = puzzle.grid;
  target.puzzleItems = puzzle.puzzleItems as typeof target.puzzleItems;
  target.estimatedTime = puzzle.estimatedTime ?? 30;
  target.coinReward = puzzle.coinReward ?? 50;
  target.isActive = true;
  target.packageId = pkg._id as mongoose.Types.ObjectId;
  await target.save();

  console.log('✅ Updated puzzle:', target._id.toString());
  console.log(
    `  ${target.grid.rows}x${target.grid.cols}, ${target.puzzleItems.length} clues ` +
      `(${imageItems.length} image)`
  );
  for (const img of imageItems) {
    console.log(
        `  image #${img.number} @ (${img.startRow},${img.startCol}) ` +
        `exit (${img.exitRow},${img.exitCol}) ${img.direction} → ${img.answer}` +
        (img.imageUrl ? `\n       ${img.imageUrl}` : '')
    );
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
