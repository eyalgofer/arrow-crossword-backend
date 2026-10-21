/**
 * Package 1 puzzle 1: an 8×8 board from the daily generator, easy clue mix.
 * Several boards are generated; the one with the highest crossing, then dual ratio, is kept.
 *
 * Usage:
 *   npx ts-node src/scripts/seedIntroPuzzle.ts
 *   npx ts-node src/scripts/seedIntroPuzzle.ts --write
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Puzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { Difficulty } from '../types';
import { generateDailyPuzzle } from './generators/puzzlesGenerator';
import { formatQuality, scorePuzzle } from './generators/puzzle-quality';
import { getAnswerCells } from './generators/direction-utils';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { getClueProvider } from './core/clueProvider';
import { Puzzle as GeneratedPuzzle } from './core/types';
import { connectToDatabase, handleScriptError } from './utils/scriptUtils';

dotenv.config();

const ROWS = 8;
const COLS = 8;
const CANDIDATES = 5;
const CANDIDATE_BUDGET_MS = 60_000;
const ARROWS: Record<string, string> = {
  across: '→',
  down: '↓',
  'right-down': '↘',
  'left-down': '↙',
  'down-across': '⤵',
  'up-across': '⤴',
};

function printPuzzle(puzzle: GeneratedPuzzle): void {
  const { rows, cols } = puzzle.grid;
  const display: string[][] = Array.from({ length: rows }, () => Array(cols).fill('███'));
  for (const item of puzzle.puzzleItems) {
    const prev = display[item.startRow][item.startCol];
    const arrow = ARROWS[item.direction] || '?';
    if (prev === '███') display[item.startRow][item.startCol] = `${String(item.number).padStart(2)}${arrow}`;
    else display[item.startRow][item.startCol] = `${arrow}${prev.slice(2)}`.slice(0, 3);
  }
  for (const item of puzzle.puzzleItems) {
    const answer = item.answer.replace(/\s+/g, '');
    getAnswerCells(item).forEach((cell, i) => {
      display[cell.row][cell.col] = ` ${answer[i]} `;
    });
  }
  console.log(`\n${rows}x${cols} | ${puzzle.puzzleItems.length} clues | ${formatQuality(scorePuzzle(puzzle))}`);
  for (let r = 0; r < rows; r++) console.log('|' + display[r].join('|') + '|');
  console.log('');
  for (const item of puzzle.puzzleItems) {
    const dir = `${item.number}${ARROWS[item.direction]}`.padEnd(5);
    console.log(`  ${dir} ${item.clue.padEnd(32)} = ${item.answer}`);
  }
}

async function writeSlot(puzzle: GeneratedPuzzle): Promise<void> {
  await connectToDatabase();
  const pkg =
    (await PuzzlePackage.findOne({ language: 'he', name: 'אוסף תשחצים 1' })) ??
    (await PuzzlePackage.findOne({ language: 'he', order: 0 }));
  if (!pkg) throw new Error('Hebrew package 1 was not found');
  const previousId = pkg.puzzleIds[0];
  if (!previousId) throw new Error('Package 1 has no first puzzle');

  const created = await Puzzle.create({
    title: puzzle.title,
    difficulty: Difficulty.EASY,
    category: puzzle.category,
    language: 'he',
    grid: puzzle.grid,
    puzzleItems: puzzle.puzzleItems,
    estimatedTime: puzzle.estimatedTime,
    coinReward: puzzle.coinReward,
    isActive: true,
    packageId: pkg._id,
    metadata: {
      templateId: puzzle.metadata?.templateId,
      generationMethod: puzzle.metadata?.generationMethod ?? 'daily-framed',
    },
  });

  const assigned = await PuzzlePackage.updateOne(
    { _id: pkg._id },
    { $set: { 'puzzleIds.0': created._id } }
  );
  if (assigned.matchedCount !== 1) throw new Error('Package 1 puzzle 1 was not reassigned');

  console.log(
    `\n✅ Package 1 puzzle 1 is now ${created._id} (${puzzle.grid.rows}x${puzzle.grid.cols}, ` +
      `${puzzle.puzzleItems.length} clues). Previous id ${previousId} is no longer in the package.`
  );
  await mongoose.disconnect();
}

/** Answers that have a short, easy, high-quality clue. The daily generator fills the grid. */
function easyWords(): string[] {
  const provider = getClueProvider('he');
  return provider.getWordPool().filter((word) => {
    const meta = provider.getWordMeta?.(word);
    if (meta?.excludeFromDaily) return false;
    const clues = provider.getScoredClues?.(word) ?? [];
    return clues.some((clue) => clue.difficulty === 1 && clue.quality >= 4 && clue.text.length <= 28);
  });
}

function betterBoard(candidate: GeneratedPuzzle, current: GeneratedPuzzle): boolean {
  const next = scorePuzzle(candidate);
  const best = scorePuzzle(current);
  if (next.crossingRatio !== best.crossingRatio) return next.crossingRatio > best.crossingRatio;
  return next.dualRatio > best.dualRatio;
}

async function main(): Promise<void> {
  const words = easyWords();
  console.log(`Easy high-quality pool: ${words.length} answers`);
  let best: GeneratedPuzzle | null = null;
  for (let i = 1; i <= CANDIDATES; i++) {
    console.log(`\n—— Candidate ${i}/${CANDIDATES} ——`);
    const puzzle = generateDailyPuzzle({
      rows: ROWS,
      cols: COLS,
      title: 'פתיחה',
      category: 'כללי',
      imageClueCount: 0,
      imageClueCatalog: [],
      difficulty: Difficulty.EASY,
      difficultyWeights: { 1: 100, 2: 0, 3: 0 },
      targetDifficulty: 1,
      words,
      timeBudgetMs: CANDIDATE_BUDGET_MS,
    });
    if (!puzzle) {
      console.log(`Candidate ${i} did not fill`);
      continue;
    }
    const errors = validatePuzzleBoundaries(puzzle);
    if (errors.length > 0) {
      console.log(`Candidate ${i} failed boundaries:\n${errors.join('\n')}`);
      continue;
    }
    const stats = scorePuzzle(puzzle);
    console.log(
      `Candidate ${i}: cross=${stats.crossingRatio.toFixed(2)} dual=${stats.dualRatio.toFixed(2)}`
    );
    if (!best || betterBoard(puzzle, best)) best = puzzle;
  }
  if (!best) throw new Error('Daily generator did not fill an 8×8 easy board');
  console.log('\n—— Best board ——');
  printPuzzle(best);
  if (process.argv.includes('--write')) await writeSlot(best);
}

main().catch((error) => {
  handleScriptError(error);
});
