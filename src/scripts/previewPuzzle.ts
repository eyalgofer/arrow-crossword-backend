/**
 * Generate puzzles locally (no database) and print them to the console.
 * Useful for checking grid and clue quality before seeding.
 *
 * Usage:
 *   npx ts-node src/scripts/previewPuzzle.ts [difficulty] [rows] [cols] [count] [--lang he] [--images 2]
 *   npm run preview:puzzle
 */

import { Difficulty, Language } from '../types';
import { Puzzle } from './core/types';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { getAnswerCells } from './generators/direction-utils';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { formatQuality, scorePuzzle } from './generators/puzzle-quality';
import { loadGeneratedImageClueCatalog } from './generators/imageClueCatalog';
import { MIN_GRID_SIZE } from './utils/gridSizes';

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

function argValue(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const language: Language = argValue('--lang') === 'he' ? 'he' : 'en';
const imageClueCount = parseInt(argValue('--images') ?? '0', 10) || 0;
const skip = new Set(['--lang', '--images']);
const positional = process.argv.slice(2).filter((arg, i, args) => {
  if (skip.has(arg)) return false;
  if (i > 0 && skip.has(args[i - 1])) return false;
  return true;
});

const difficulty = (positional[0] as Difficulty) || Difficulty.EASY;
const defaultSize = language === 'he' ? MIN_GRID_SIZE : 8;
const rows = Math.min(parseInt(positional[1] || String(defaultSize), 10), 16);
const cols = Math.min(parseInt(positional[2] || String(defaultSize), 10), 16);
const count = parseInt(positional[3] || '1', 10);

const imageClueCatalog =
  language === 'he' && imageClueCount > 0 ? loadGeneratedImageClueCatalog() : undefined;
if (imageClueCount > 0 && (!imageClueCatalog || imageClueCatalog.length < imageClueCount)) {
  console.error(
    `Need image clues, found ${imageClueCatalog?.length ?? 0}. ` +
      `Run scripts/arrow-image-pipeline \`npm run process\` first.`
  );
  process.exit(1);
}

const puzzles = generatePuzzlesBatch({
  difficulty,
  count,
  category: language === 'he' ? 'תצוגה' : 'Preview',
  startIndex: 1,
  rows,
  cols,
  language,
  strictSize: language === 'he',
  imageClueCount: language === 'he' ? imageClueCount : 0,
  imageClueCatalog,
  imageClueAttempts: imageClueCount > 0 ? (rows >= 15 && cols >= 15 ? 60 : 48) : undefined,
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
