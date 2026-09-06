/**
 * Generate puzzles locally (no database) and print them to the console.
 * Useful for checking grid and clue quality before seeding.
 *
 * Usage:
 *   npx ts-node src/scripts/previewPuzzle.ts [difficulty] [rows] [cols] [count] [--lang he]
 *   npm run preview:puzzle
 */

import { Difficulty, Language } from '../types';
import { Puzzle } from './core/types';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { getAnswerCells } from './generators/direction-utils';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';

const ARROWS: Record<string, string> = {
  'across': '→',
  'down': '↓',
  'right-down': '↘',
  'left-down': '↙',
  'down-across': '⤵',
  'up-across': '⤴',
};

function printPuzzle(puzzle: Puzzle): void {
  const { rows, cols } = puzzle.grid;

  // Build display grid: letters, clue numbers, blocked cells
  const display: string[][] = Array.from({ length: rows }, () => Array(cols).fill('███'));
  for (const item of puzzle.puzzleItems) {
    display[item.startRow][item.startCol] = `${String(item.number).padStart(2)}${ARROWS[item.direction] || '?'}`;
  }
  for (const item of puzzle.puzzleItems) {
    const cells = getAnswerCells(item);
    const answer = item.answer.replace(/\s+/g, '');
    cells.forEach((cell, i) => {
      display[cell.row][cell.col] = ` ${answer[i]} `;
    });
  }

  console.log(`\n${'='.repeat(cols * 4 + 1)}`);
  console.log(`${puzzle.title} | ${puzzle.difficulty} | ${rows}x${cols} | ${puzzle.puzzleItems.length} clues`);
  console.log('='.repeat(cols * 4 + 1));
  for (let r = 0; r < rows; r++) {
    console.log('|' + display[r].join('|') + '|');
  }
  console.log('');
  for (const item of puzzle.puzzleItems) {
    const dir = `${item.number}${ARROWS[item.direction]}`.padEnd(4);
    const enumeration = item.enumeration;
    const enumLabel = enumeration && enumeration.length > 1 ? ` (${enumeration.join(',')})` : '';
    console.log(`  ${dir} ${(item.clue + enumLabel).padEnd(42)} = ${item.answer}`);
  }
}

const langArgIndex = process.argv.indexOf('--lang');
const language: Language = langArgIndex !== -1 && process.argv[langArgIndex + 1] === 'he' ? 'he' : 'en';
const positional = process.argv.slice(2).filter((arg, i, args) => arg !== '--lang' && args[i - 1] !== '--lang');

const difficulty = (positional[0] as Difficulty) || Difficulty.EASY;
const rows = Math.min(parseInt(positional[1] || '8', 10), 16);
const cols = Math.min(parseInt(positional[2] || '8', 10), 16);
const count = parseInt(positional[3] || '1', 10);

const puzzles = generatePuzzlesBatch({
  difficulty,
  count,
  category: language === 'he' ? 'תצוגה' : 'Preview',
  startIndex: 1,
  rows,
  cols,
  language,
});

for (const puzzle of puzzles) {
  const errors = validatePuzzleBoundaries(puzzle);
  printPuzzle(puzzle);
  if (errors.length > 0) {
    console.error(`❌ Boundary validation failed:\n${errors.join('\n')}`);
  } else {
    console.log('✅ Boundary validation passed');
  }
}

if (puzzles.length === 0) {
  console.error('❌ No puzzles generated');
  process.exit(1);
}
