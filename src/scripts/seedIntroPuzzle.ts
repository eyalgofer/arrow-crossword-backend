/**
 * Package 1 puzzle 1: a 12×9 board from the daily generator, easy clue mix.
 *
 * Usage:
 *   npx ts-node src/scripts/seedIntroPuzzle.ts
 *   npx ts-node src/scripts/seedIntroPuzzle.ts --write
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Puzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { Difficulty } from '../types';
import { generateDailyPuzzle } from './generators/puzzlesGenerator';
import { formatQuality, scorePuzzle } from './generators/puzzle-quality';
import { getAnswerCells } from './generators/direction-utils';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { getClueProvider } from './core/clueProvider';
import { Puzzle as GeneratedPuzzle } from './core/types';
import { connectToDatabase, handleScriptError } from './utils/scriptUtils';

dotenv.config();

const ROWS = 12;
const COLS = 9;
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

async function refreshProgress(
  puzzleId: mongoose.Types.ObjectId,
  items: Array<{ number: number; direction: string }>
): Promise<void> {
  const completedClueIds = items.map((item) => `${item.number}|${item.direction}`);
  const totalClues = items.length;
  await UserPuzzleProgress.updateMany(
    { puzzleId, isCompleted: true },
    { $set: { completedClueIds, completedCluesCount: totalClues, totalClues } }
  );
  await UserPuzzleProgress.updateMany(
    { puzzleId, isCompleted: { $ne: true } },
    { $set: { completedClueIds: [], completedCluesCount: 0, elapsedTime: 0, totalClues } }
  );
}

async function writeSlot(puzzle: GeneratedPuzzle): Promise<void> {
  await connectToDatabase();
  const pkg =
    (await PuzzlePackage.findOne({ language: 'he', name: 'אוסף תשחצים 1' })) ??
    (await PuzzlePackage.findOne({ language: 'he', order: 0 }));
  if (!pkg) throw new Error('Hebrew package 1 was not found');
  const puzzleId = pkg.puzzleIds[0];
  if (!puzzleId) throw new Error('Package 1 has no first puzzle');

  const before = await UserPuzzleProgress.countDocuments({ puzzleId, isCompleted: true });
  const updated = await Puzzle.updateOne(
    { _id: puzzleId, packageId: pkg._id },
    {
      $set: {
        grid: puzzle.grid,
        puzzleItems: puzzle.puzzleItems,
        difficulty: Difficulty.EASY,
        estimatedTime: puzzle.estimatedTime,
        coinReward: puzzle.coinReward,
        category: puzzle.category,
        language: 'he',
        metadata: {
          templateId: puzzle.metadata?.templateId,
          generationMethod: puzzle.metadata?.generationMethod ?? 'daily-framed',
        },
      },
    }
  );
  if (updated.matchedCount !== 1) throw new Error(`Puzzle ${puzzleId} was not updated`);
  await refreshProgress(puzzleId as mongoose.Types.ObjectId, puzzle.puzzleItems);
  const after = await UserPuzzleProgress.countDocuments({ puzzleId, isCompleted: true });
  if (before !== after) {
    throw new Error(`Completed count changed for package 1 puzzle 1: ${before} → ${after}`);
  }
  console.log(
    `\n✅ Package 1 puzzle 1 (${puzzleId}) is now ${puzzle.grid.rows}x${puzzle.grid.cols}, ` +
      `${puzzle.puzzleItems.length} clues. Completed rows unchanged: ${after}`
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

async function main(): Promise<void> {
  const words = easyWords();
  console.log(`Easy high-quality pool: ${words.length} answers`);
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
    timeBudgetMs: 180000,
  });
  if (!puzzle) throw new Error('Daily generator did not fill a 12×9 easy board');
  const errors = validatePuzzleBoundaries(puzzle);
  if (errors.length > 0) throw new Error(`Boundary validation failed:\n${errors.join('\n')}`);
  printPuzzle(puzzle);
  if (process.argv.includes('--write')) await writeSlot(puzzle);
}

main().catch((error) => {
  handleScriptError(error);
});
