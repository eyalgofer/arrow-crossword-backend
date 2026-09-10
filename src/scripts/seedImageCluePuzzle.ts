/**
 * Replace one Hebrew package puzzle with a mixed-arrow image-clue תשחץ.
 *
 * Usage:
 *   npx ts-node src/scripts/seedImageCluePuzzle.ts --package 3 --puzzle 1
 *   npx ts-node src/scripts/seedImageCluePuzzle.ts --package 3 --puzzle 1 --from tmp-image-clue-puzzle.json
 *   npm run seed:image-clues
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
import {
  ImageClueCatalogEntry,
  loadGeneratedImageClueCatalog,
  loadImageClueCatalogFromMongo,
} from './generators/imageClueCatalog';
import { formatQuality, puzzleQualityOk, scorePuzzle } from './generators/puzzle-quality';
import { getAnswerCells, getUncoveredCells } from './generators/direction-utils';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { connectToDatabase } from './utils/scriptUtils';
import { normalizeWord } from './generators/validation-utils';

const ARROWS: Record<string, string> = {
  across: '→',
  down: '↓',
  'right-down': '↘',
  'left-down': '↙',
  'down-across': '⤵',
  'up-across': '⤴',
};

function argValue(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const PACKAGE_NUMBER = parseInt(argValue('--package', '3') ?? '3', 10);
const PUZZLE_NUMBER = parseInt(argValue('--puzzle', '1') ?? '1', 10);
const MIN_IMAGE_CLUES = parseInt(argValue('--images', '2') ?? '2', 10);
const FROM_FILE = argValue('--from');
const PUZZLE_TITLE = `#${PUZZLE_NUMBER}`;

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

function printPuzzle(puzzle: GeneratedPuzzle): void {
  const { rows, cols } = puzzle.grid;
  const display: string[][] = Array.from({ length: rows }, () => Array(cols).fill('███'));
  for (const item of puzzle.puzzleItems) {
    if (item.clueType === 'image' && item.exitRow != null && item.exitCol != null) {
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const r = item.startRow + dr;
          const c = item.startCol + dc;
          if (r === item.exitRow && c === item.exitCol) {
            display[r][c] = `${String(item.number).padStart(2)}${ARROWS[item.direction] || '?'}`;
          } else {
            display[r][c] = 'IMG';
          }
        }
      }
    } else {
      const prev = display[item.startRow][item.startCol];
      const arrow = ARROWS[item.direction] || '?';
      if (prev === '███') {
        display[item.startRow][item.startCol] = `${String(item.number).padStart(2)}${arrow}`;
      } else {
        const prevArrow = prev.slice(2);
        display[item.startRow][item.startCol] = `${arrow}${prevArrow} `.slice(0, 3);
      }
    }
  }
  for (const item of puzzle.puzzleItems) {
    const cells = getAnswerCells(item);
    const answer = item.answer.replace(/\s+/g, '');
    cells.forEach((cell, i) => {
      display[cell.row][cell.col] = ` ${answer[i]} `;
    });
  }

  const stats = scorePuzzle(puzzle);
  const kinds = stats.kinds.map((kind) => ARROWS[kind] || kind).join(' ');
  console.log(`\n${'='.repeat(cols * 4 + 1)}`);
  console.log(`${puzzle.title} | ${puzzle.difficulty} | ${rows}x${cols} | ${puzzle.puzzleItems.length} clues`);
  console.log(`${formatQuality(stats)} | arrows ${kinds}`);
  console.log('='.repeat(cols * 4 + 1));
  for (let r = 0; r < rows; r++) {
    console.log('|' + display[r].join('|') + '|');
  }
  console.log('');
  for (const item of puzzle.puzzleItems) {
    const dir = `${item.number}${ARROWS[item.direction]}`.padEnd(4);
    const enumeration = item.enumeration;
    const enumLabel = enumeration && enumeration.length > 1 ? ` (${enumeration.join(',')})` : '';
    const image = item.clueType === 'image' ? ' [image]' : '';
    console.log(`  ${dir} ${(item.clue + enumLabel).padEnd(42)} = ${item.answer}${image}`);
  }
}

async function generateFresh(catalog: ImageClueCatalogEntry[]): Promise<GeneratedPuzzle> {
  console.log(
    `Generating mixed-arrow תשחץ (13→15) with ${MIN_IMAGE_CLUES} image clues (catalog ${catalog.length})...`
  );
  const puzzle = generateLargestImageCluePuzzle({
    category: 'כללי',
    startIndex: PUZZLE_NUMBER,
    imageClueCount: MIN_IMAGE_CLUES,
    imageClueCatalog: catalog,
    imageClueAttempts: 48,
    sizes: [{ rows: 13, cols: 13 }],
  });
  if (!puzzle) {
    throw new Error('Failed to generate Hebrew image-clue puzzle');
  }
  const stats = scorePuzzle(puzzle);
  if (!puzzleQualityOk(stats, MIN_IMAGE_CLUES) || getUncoveredCells(puzzle).length > 0) {
    throw new Error(`Generated puzzle failed quality: ${formatQuality(stats)}`);
  }
  return puzzle;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is required in .env');
    process.exit(1);
  }
  if (!Number.isInteger(PACKAGE_NUMBER) || PACKAGE_NUMBER < 1) {
    throw new Error('--package must be a 1-based package number');
  }
  if (!Number.isInteger(PUZZLE_NUMBER) || PUZZLE_NUMBER < 1) {
    throw new Error('--puzzle must be a 1-based puzzle number');
  }

  await connectToDatabase();
  console.log('Connected to', mongoose.connection.db?.databaseName);

  const catalog = mergeCatalogs(
    await loadImageClueCatalogFromMongo(),
    loadGeneratedImageClueCatalog()
  );
  if (catalog.length < MIN_IMAGE_CLUES) {
    throw new Error(
      `Need image clues in Mongo/local catalog, found ${catalog.length}. ` +
        `Run scripts/arrow-image-pipeline \`npm run process\` first.`
    );
  }

  const pkg =
    (await PuzzlePackage.findOne({ language: 'he', name: `אוסף תשחצים ${PACKAGE_NUMBER}` })) ??
    (await PuzzlePackage.findOne({ language: 'he', order: PACKAGE_NUMBER - 1 }));
  if (!pkg) {
    const all = await PuzzlePackage.find({ language: 'he' }).sort({ order: 1 }).lean();
    console.log(
      'Hebrew packages:',
      all.map((p) => `order=${p.order} "${p.name}" (${p.puzzleIds?.length})`).join(', ') || '(none)'
    );
    throw new Error(`Hebrew package ${PACKAGE_NUMBER} not found`);
  }
  console.log(`Package: ${pkg.name} order=${pkg.order} (${pkg._id}) — ${pkg.puzzleIds.length} puzzles`);

  const slotIndex = PUZZLE_NUMBER - 1;
  let target = await Puzzle.findOne({
    packageId: pkg._id,
    title: PUZZLE_TITLE,
    language: 'he',
  });
  if (!target) {
    const id = pkg.puzzleIds[slotIndex];
    if (!id) throw new Error(`No puzzle at package slot ${PUZZLE_NUMBER}`);
    target = await Puzzle.findById(id);
    if (!target) throw new Error(`Puzzle ${id} missing`);
    console.log(`Using slot ${PUZZLE_NUMBER} by index (title was "${target.title}")`);
  }

  console.log(
    `Current ${target.title} (${target._id}) ${target.grid.rows}x${target.grid.cols} ` +
      `${target.puzzleItems.length} clues, ` +
      `${target.puzzleItems.filter((item) => item.clueType === 'image').length} images`
  );

  let puzzle: GeneratedPuzzle;
  if (FROM_FILE) {
    const filePath = path.resolve(FROM_FILE);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Puzzle file not found: ${filePath}`);
    }
    console.log(`Loading puzzle from ${filePath}`);
    puzzle = JSON.parse(fs.readFileSync(filePath, 'utf8')) as GeneratedPuzzle;
  } else {
    puzzle = await generateFresh(catalog);
  }
  puzzle.title = PUZZLE_TITLE;
  const boundaryErrors = validatePuzzleBoundaries(puzzle);
  if (boundaryErrors.length > 0) {
    throw new Error(`Boundary validation failed:\n${boundaryErrors.join('\n')}`);
  }
  const imageItems = puzzle.puzzleItems.filter((item) => item.clueType === 'image');
  if (imageItems.length < MIN_IMAGE_CLUES) {
    throw new Error(`Expected at least ${MIN_IMAGE_CLUES} image clues, got ${imageItems.length}`);
  }

  printPuzzle(puzzle);

  if (mongoose.connection.readyState !== 1) {
    await connectToDatabase();
  }

  await UserPuzzleProgress.deleteMany({ puzzleId: target._id });

  target.title = PUZZLE_TITLE;
  target.difficulty = target.difficulty || Difficulty.EASY;
  target.category = puzzle.category;
  target.language = 'he';
  target.grid = puzzle.grid;
  target.puzzleItems = puzzle.puzzleItems as typeof target.puzzleItems;
  target.estimatedTime = puzzle.estimatedTime ?? 30;
  target.coinReward = puzzle.coinReward ?? 50;
  target.isActive = true;
  target.packageId = pkg._id as mongoose.Types.ObjectId;
  await target.save();

  console.log('\n✅ Updated puzzle:', target._id.toString());
  console.log(
    `  ${pkg.name} ${target.title} → ${target.grid.rows}x${target.grid.cols}, ` +
      `${target.puzzleItems.length} clues (${imageItems.length} image)`
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
