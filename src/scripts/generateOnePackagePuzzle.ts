/**
 * Generate one Hebrew text package puzzle (no images) and write JSON to --out.
 * Used by seedPackages --force in parallel (same pattern as generateOneFav / dailies).
 *
 * Usage:
 *   npx ts-node src/scripts/generateOnePackagePuzzle.ts --out tmp/p-1.json --difficulty easy --rows 14 --cols 14 --attempts 48
 */

import * as fs from 'fs';
import * as path from 'path';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { getUncoveredCells } from './generators/direction-utils';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { Puzzle as GeneratedPuzzle } from './core/types';
import { Difficulty } from '../types';
import { scorePuzzle, formatQuality, puzzleQualityOk } from './generators/puzzle-quality';

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function parseDifficulty(raw: string): Difficulty {
  const v = raw.toLowerCase();
  if (v === 'easy') return Difficulty.EASY;
  if (v === 'medium') return Difficulty.MEDIUM;
  if (v === 'hard') return Difficulty.HARD;
  throw new Error(`Unknown difficulty: ${raw}`);
}

function puzzleIsReady(puzzle: GeneratedPuzzle): boolean {
  return (
    puzzle.grid?.rows >= 13 &&
    puzzle.grid?.cols >= 13 &&
    (puzzle.puzzleItems?.length ?? 0) > 0 &&
    getUncoveredCells(puzzle).length === 0 &&
    validatePuzzleBoundaries(puzzle).length === 0 &&
    puzzleQualityOk(scorePuzzle(puzzle), 0, true)
  );
}

function main() {
  const out = arg('--out');
  const difficulty = parseDifficulty(arg('--difficulty', 'easy') ?? 'easy');
  const attempts = parseInt(arg('--attempts', '48') ?? '48', 10);
  const rows = parseInt(arg('--rows', '14') ?? '14', 10);
  const cols = parseInt(arg('--cols', '14') ?? '14', 10);
  const index = parseInt(arg('--index', '1') ?? '1', 10);
  if (!out) {
    console.error('Missing --out');
    process.exit(1);
  }

  console.log(`[pkg ${index}] ${difficulty} ${rows}x${cols}, ${attempts} attempts`);
  const batch = generatePuzzlesBatch({
    difficulty,
    count: 1,
    category: 'כללי',
    startIndex: index,
    rows,
    cols,
    sizes: [{ rows, cols }],
    language: 'he',
    // Allow shrink toward 13 if this size will not fill.
    strictSize: false,
    attempts,
  });

  const puzzle = batch[0];
  if (!puzzle || !puzzleIsReady(puzzle)) {
    console.error(`[pkg ${index}] FAILED`);
    process.exit(1);
  }

  const dir = path.dirname(out);
  if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(out, JSON.stringify(puzzle, null, 2));
  console.log(
    `[pkg ${index}] OK ${puzzle.grid.rows}x${puzzle.grid.cols} clues=${puzzle.puzzleItems.length} ` +
      `${formatQuality(scorePuzzle(puzzle))} → ${out}`
  );
}

main();
