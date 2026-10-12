/**
 * Generate one Hebrew (or he-en bilingual) text package puzzle and write JSON to --out.
 * Used by seedPackages --force in parallel (same pattern as generateOneFav / dailies).
 *
 * Usage:
 *   npx ts-node src/scripts/generateOnePackagePuzzle.ts --out tmp/p-1.json --difficulty easy --rows 14 --cols 14 --attempts 48
 *   npx ts-node src/scripts/generateOnePackagePuzzle.ts --lang he-en --out tmp/p-1.json --difficulty easy --rows 14 --cols 14
 *   npx ts-node src/scripts/generateOnePackagePuzzle.ts --profile daily --out tmp/p-1.json --difficulty easy --rows 10 --cols 12 --recent tmp/recent.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateDailyPuzzle, generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { getUncoveredCells } from './generators/direction-utils';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { Puzzle as GeneratedPuzzle } from './core/types';
import { Difficulty, Language } from '../types';
import { scorePuzzle, formatQuality, puzzleQualityOk, dailyTargetMisses, dailyTargetsFor } from './generators/puzzle-quality';
import {
  clueDifficultyMeanOk,
  meanChosenClueDifficulty,
  PACKAGE_CLUE_WEIGHTS,
} from './generators/puzzle-assembler';
import { readRecentDailyContent } from './utils/recentDailyContent';
import { getClueProvider } from './core/clueProvider';

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

function parseLanguage(raw: string | undefined): Language {
  if (raw === 'he-en' || raw === 'he' || raw === 'en') return raw;
  return 'he';
}

function puzzleIsReady(puzzle: GeneratedPuzzle, minSize = 13): boolean {
  return (
    puzzle.grid?.rows >= minSize &&
    puzzle.grid?.cols >= minSize &&
    (puzzle.puzzleItems?.length ?? 0) > 0 &&
    getUncoveredCells(puzzle).length === 0 &&
    validatePuzzleBoundaries(puzzle).length === 0 &&
    puzzleQualityOk(scorePuzzle(puzzle), 0, true)
  );
}

function dailyPuzzleIsReady(
  puzzle: GeneratedPuzzle,
  rows: number,
  cols: number,
  difficulty: Difficulty,
  language: Language
): boolean {
  if (puzzle.grid?.rows !== rows || puzzle.grid?.cols !== cols) return false;
  if ((puzzle.puzzleItems?.length ?? 0) === 0) return false;
  if (getUncoveredCells(puzzle).length > 0) return false;
  if (validatePuzzleBoundaries(puzzle).length > 0) return false;
  const stats = scorePuzzle(puzzle);
  if (dailyTargetMisses(stats, dailyTargetsFor(0, puzzle.grid)).length > 0) return false;
  if (difficulty !== Difficulty.EASY && difficulty !== Difficulty.MEDIUM && difficulty !== Difficulty.HARD) {
    return false;
  }
  const provider = getClueProvider(language);
  const mean = meanChosenClueDifficulty(puzzle.puzzleItems, (answer) => provider.getScoredClues?.(answer) ?? []);
  return mean != null && clueDifficultyMeanOk(difficulty as 'easy' | 'medium' | 'hard', mean);
}

function main() {
  const out = arg('--out');
  const language = parseLanguage(arg('--lang', 'he'));
  const difficulty = parseDifficulty(arg('--difficulty', 'easy') ?? 'easy');
  const attempts = parseInt(arg('--attempts', '48') ?? '48', 10);
  const rows = parseInt(arg('--rows', '14') ?? '14', 10);
  const cols = parseInt(arg('--cols', '14') ?? '14', 10);
  const index = parseInt(arg('--index', '1') ?? '1', 10);
  const profile = arg('--profile', 'legacy');
  if (!out) {
    console.error('Missing --out');
    process.exit(1);
  }

  if (profile === 'daily') {
    const budget = parseInt(arg('--budget', '120000') ?? '120000', 10);
    const recent = readRecentDailyContent(arg('--recent'));
    const weights = PACKAGE_CLUE_WEIGHTS[difficulty as 'easy' | 'medium' | 'hard'];
    console.log(
      `[pkg ${index}] daily ${language} ${difficulty} ${rows}x${cols}, budget ${budget}ms, ` +
        `avoid ${recent.answers.length} answers`
    );
    const puzzle = generateDailyPuzzle({
      rows,
      cols,
      title: `#${index}`,
      category: 'כללי',
      imageClueCount: 0,
      imageClueCatalog: [],
      difficulty,
      difficultyWeights: weights,
      avoidAnswers: recent.answers,
      timeBudgetMs: budget,
      language,
    });
    if (!puzzle || !dailyPuzzleIsReady(puzzle, rows, cols, difficulty, language)) {
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
    return;
  }

  const minSize = language === 'he-en' ? 12 : 13;
  console.log(`[pkg ${index}] ${language} ${difficulty} ${rows}x${cols}, ${attempts} attempts`);
  const batch = generatePuzzlesBatch({
    difficulty,
    count: 1,
    category: 'כללי',
    startIndex: index,
    rows,
    cols,
    sizes: [{ rows, cols }],
    language,
    // Allow shrink if this size will not fill.
    strictSize: false,
    minGridSize: minSize,
    attempts,
  });

  const puzzle = batch[0];
  if (!puzzle || !puzzleIsReady(puzzle, minSize)) {
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
