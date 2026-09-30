/**
 * Generate seven Hebrew text boards, 12×12, one per clue category, and wire
 * them as the "תשחצים לפי קטגוריה" carousel.
 *
 * Each board is filled from that category only. If the category pool cannot
 * fill 12×12 (sport is the thin one), general answers are added as filler and
 * tried only after the category's own words.
 *
 * Usage:
 *   npm run seed:category-puzzles
 *   npx ts-node src/scripts/seedCategoryPuzzles.ts --dry-run
 *   npx ts-node src/scripts/seedCategoryPuzzles.ts --attempts 64
 */

import dotenv from 'dotenv';
dotenv.config();

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Puzzle } from '../models/Puzzle';
import { CategoryPuzzle, CategoryPuzzleKey } from '../models/CategoryPuzzle';
import { Difficulty } from '../types';
import { Puzzle as GeneratedPuzzle } from './core/types';
import { HebrewCategory } from './core/hebrewClueStore';
import { getWordMeta, getWordPool } from './core/hebrewClueDatabase';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { getUncoveredCells } from './generators/direction-utils';
import { normalizeWord } from './generators/validation-utils';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { formatQuality, puzzleQualityOk, scorePuzzle } from './generators/puzzle-quality';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';

const LANGUAGE = 'he' as const;
const GRID = 12;
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tmp-category-puzzles');

const BOARDS: Array<{ category: CategoryPuzzleKey; label: string; accent: string }> = [
  { category: 'food', label: 'אוכל', accent: '#F4603E' },
  { category: 'people', label: 'אנשים', accent: '#8B7CF6' },
  { category: 'sport', label: 'ספורט', accent: '#6FD8B0' },
  { category: 'language', label: 'שפה', accent: '#F2C14E' },
  { category: 'science', label: 'מדע', accent: '#5B8DEF' },
  { category: 'geography', label: 'גאוגרפיה', accent: '#3DB8A0' },
  { category: 'culture', label: 'תרבות', accent: '#E07A9A' },
];

interface WorkerResult {
  category: CategoryPuzzleKey;
  label: string;
  usedGeneral: boolean;
  generalCount: number;
  puzzle: GeneratedPuzzle;
}

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function wordsFor(category: HebrewCategory): string[] {
  return getWordPool().filter((word) => getWordMeta(word)?.category === category);
}

function answerCategory(answer: string): string | undefined {
  return getWordMeta(answer)?.category;
}

function boardIsReady(
  puzzle: GeneratedPuzzle,
  category: CategoryPuzzleKey,
  allowGeneral: boolean
): boolean {
  if (puzzle.grid?.rows !== GRID || puzzle.grid?.cols !== GRID) return false;
  if ((puzzle.puzzleItems?.length ?? 0) === 0) return false;
  if (puzzle.puzzleItems.some((item) => item.clueType === 'image')) return false;
  if (getUncoveredCells(puzzle).length !== 0) return false;
  if (validatePuzzleBoundaries(puzzle).length !== 0) return false;
  if (!puzzleQualityOk(scorePuzzle(puzzle), 0, true)) return false;
  return puzzle.puzzleItems.every((item) => {
    const cat = answerCategory(item.answer);
    return cat === category || (allowGeneral && cat === 'general');
  });
}

function countGeneral(puzzle: GeneratedPuzzle): number {
  return puzzle.puzzleItems.filter((item) => answerCategory(item.answer) === 'general').length;
}

function generateBoard(
  category: CategoryPuzzleKey,
  label: string,
  attempts: number
): WorkerResult | null {
  const categoryWords = wordsFor(category);
  console.log(`[${category}] ${categoryWords.length} ${label} answers, ${GRID}x${GRID}, ${attempts} attempts`);

  const base = {
    difficulty: Difficulty.EASY,
    count: 1,
    category: label,
    startIndex: 1,
    rows: GRID,
    cols: GRID,
    sizes: [{ rows: GRID, cols: GRID }],
    language: LANGUAGE,
    strictSize: true,
    minGridSize: GRID,
    attempts,
  };

  if (categoryWords.length > 0) {
    const only = generatePuzzlesBatch({ ...base, words: categoryWords });
    const puzzle = only[0];
    if (puzzle && boardIsReady(puzzle, category, false)) {
      console.log(
        `[${category}] OK category-only ${puzzle.puzzleItems.length} clues ${formatQuality(scorePuzzle(puzzle))}`
      );
      return { category, label, usedGeneral: false, generalCount: 0, puzzle };
    }
  }

  const categoryNorm = new Set(categoryWords.map((word) => normalizeWord(word)));
  const generalWords = wordsFor('general').filter((word) => !categoryNorm.has(normalizeWord(word)));
  console.log(
    `[${category}] category-only did not fill; adding ${generalWords.length} general answers as filler`
  );
  const mixed = generatePuzzlesBatch({
    ...base,
    words: [...categoryWords, ...generalWords],
    fillerWords: generalWords,
  });
  const puzzle = mixed[0];
  if (!puzzle || !boardIsReady(puzzle, category, true)) {
    console.error(`[${category}] FAILED`);
    return null;
  }
  const generalCount = countGeneral(puzzle);
  console.log(
    `[${category}] OK with general filler ${generalCount}/${puzzle.puzzleItems.length} ` +
      `${formatQuality(scorePuzzle(puzzle))}`
  );
  return { category, label, usedGeneral: generalCount > 0, generalCount, puzzle };
}

function runWorker(): void {
  const category = arg('--category') as CategoryPuzzleKey | undefined;
  const out = arg('--out');
  const attempts = parseInt(arg('--attempts', '48') ?? '48', 10);
  const board = BOARDS.find((entry) => entry.category === category);
  if (!board || !out) {
    console.error('Worker needs --category and --out');
    process.exit(1);
  }
  const result = generateBoard(board.category, board.label, attempts);
  if (!result) process.exit(1);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result));
  process.exit(0);
}

function launch(category: CategoryPuzzleKey, outPath: string, attempts: number): Promise<WorkerResult | null> {
  return new Promise((resolve) => {
    const child = spawn(
      'npx',
      [
        'ts-node',
        'src/scripts/seedCategoryPuzzles.ts',
        '--worker',
        '--category',
        category,
        '--out',
        outPath,
        '--attempts',
        String(attempts),
      ],
      { cwd: ROOT, stdio: 'inherit' }
    );
    child.on('exit', (code) => {
      if (code !== 0 || !fs.existsSync(outPath)) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(fs.readFileSync(outPath, 'utf-8')) as WorkerResult);
      } catch {
        resolve(null);
      }
    });
  });
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const attempts = parseInt(arg('--attempts', '48') ?? '48', 10);
  if (!dryRun && !process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required in .env');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Generating ${BOARDS.length} category boards, ${GRID}×${GRID}, text only\n`);

  const results = await Promise.all(
    BOARDS.map((board) => launch(board.category, path.join(OUT_DIR, `${board.category}.json`), attempts))
  );
  const failed = BOARDS.filter((_, index) => !results[index]).map((board) => board.label);
  if (failed.length > 0) {
    throw new Error(
      `Could not fill: ${failed.join(', ')}. Category words were not enough, and general filler did not finish the board.`
    );
  }
  const ready = results as WorkerResult[];

  if (dryRun) {
    console.log(`\nDry run — boards in ${OUT_DIR}, database untouched`);
    for (const row of ready) {
      console.log(
        `   ${row.label}: ${row.puzzle.grid.rows}x${row.puzzle.grid.cols} ` +
          `clues=${row.puzzle.puzzleItems.length} general=${row.generalCount}`
      );
    }
    process.exit(0);
  }

  await connectToDatabase();
  console.log('Connected to', mongoose.connection.db?.databaseName);

  const previous = await CategoryPuzzle.find({ language: LANGUAGE }).lean();
  const previousIds = previous.map((row) => row.puzzleId).filter(Boolean);
  await CategoryPuzzle.deleteMany({ language: LANGUAGE });

  const saved = await Puzzle.insertMany(
    ready.map((row) => ({
      title: row.label,
      difficulty: Difficulty.EASY,
      category: row.label,
      language: LANGUAGE,
      grid: row.puzzle.grid,
      puzzleItems: row.puzzle.puzzleItems,
      estimatedTime: row.puzzle.estimatedTime ?? 20,
      coinReward: row.puzzle.coinReward ?? 40,
      isActive: true,
    }))
  );

  await CategoryPuzzle.insertMany(
    saved.map((doc, index) => ({
      puzzleId: doc._id,
      order: index,
      language: LANGUAGE,
      category: ready[index].category,
      label: ready[index].label,
      accent: BOARDS[index].accent,
      isActive: true,
    }))
  );

  if (previousIds.length) {
    await Puzzle.deleteMany({
      _id: { $in: previousIds },
      packageId: { $exists: false },
    });
  }

  console.log(`\nWired ${saved.length} puzzles to category_puzzles (replaced ${previousIds.length})`);
  for (let i = 0; i < saved.length; i++) {
    console.log(
      `   ${i + 1}. ${ready[i].label} ${saved[i]._id} general=${ready[i].generalCount}/${ready[i].puzzle.puzzleItems.length}`
    );
  }

  await closeDatabaseAndExit(0);
}

if (process.argv.includes('--worker')) {
  runWorker();
} else {
  main().catch(handleScriptError);
}
