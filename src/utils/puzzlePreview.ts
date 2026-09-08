import { PuzzleItem } from '../types';

export type PuzzlePreview = {
  gridSize: string;
  shape: boolean[];
  letters: string[];
};

const PREVIEW = 5;
const TARGET_LETTERS_MIN = 8;
const TARGET_LETTERS_MAX = 9;

function answerLetters(answer: string): string {
  return (answer ?? '').replace(/[\s\-–—]+/g, '');
}

function clueAnchor(item: PuzzleItem): { row: number; col: number } {
  if (item.clueType === 'image' && item.exitRow != null && item.exitCol != null) {
    return { row: item.exitRow, col: item.exitCol };
  }
  return { row: item.startRow, col: item.startCol };
}

function answerCells(item: PuzzleItem): Array<{ row: number; col: number; letter: string }> {
  const letters = Array.from(answerLetters(item.answer));
  const { row: anchorRow, col: anchorCol } = clueAnchor(item);
  const cells: Array<{ row: number; col: number; letter: string }> = [];

  for (let i = 0; i < letters.length; i++) {
    let row = anchorRow;
    let col = anchorCol;
    switch (item.direction) {
      case 'across':
        row = anchorRow;
        col = anchorCol + 1 + i;
        break;
      case 'down':
        row = anchorRow + 1 + i;
        col = anchorCol;
        break;
      case 'right-down':
        row = anchorRow + i;
        col = anchorCol + 1;
        break;
      case 'down-across':
        row = anchorRow + 1;
        col = anchorCol + i;
        break;
      case 'left-down':
        row = anchorRow + i;
        col = anchorCol - 1;
        break;
      case 'up-across':
        row = anchorRow - 1;
        col = anchorCol + i;
        break;
    }
    cells.push({ row, col, letter: letters[i] });
  }

  return cells;
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * 5×5 silhouette of a puzzle: blocked clue/image cells plus a handful of letters.
 * Deterministic so the same puzzle always renders the same card preview.
 */
export function buildPuzzlePreview(
  grid: { rows: number; cols: number },
  puzzleItems: PuzzleItem[]
): PuzzlePreview {
  const { rows, cols } = grid;
  const blocked = new Set<string>();
  const letterAt = new Map<string, string>();

  for (const item of puzzleItems) {
    if (item.clueType === 'image') {
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          blocked.add(cellKey(item.startRow + dr, item.startCol + dc));
        }
      }
    } else {
      blocked.add(cellKey(item.startRow, item.startCol));
    }
    for (const cell of answerCells(item)) {
      letterAt.set(cellKey(cell.row, cell.col), cell.letter);
    }
  }

  const shape: boolean[] = [];
  const letters: string[] = [];

  for (let i = 0; i < PREVIEW; i++) {
    for (let j = 0; j < PREVIEW; j++) {
      const r = Math.min(rows - 1, Math.floor((i * rows) / PREVIEW));
      const c = Math.min(cols - 1, Math.floor((j * cols) / PREVIEW));
      const key = cellKey(r, c);
      const isBlocked = blocked.has(key);
      shape.push(isBlocked);
      letters.push(isBlocked ? '' : (letterAt.get(key) ?? ''));
    }
  }

  const filledIdx = letters
    .map((letter, index) => (letter ? index : -1))
    .filter((index) => index >= 0);

  if (filledIdx.length > TARGET_LETTERS_MAX) {
    const n = TARGET_LETTERS_MAX;
    const step = filledIdx.length / n;
    const keep = new Set(
      Array.from({ length: n }, (_, k) => filledIdx[Math.floor(k * step)])
    );
    for (let i = 0; i < letters.length; i++) {
      if (!keep.has(i)) letters[i] = '';
    }
  } else if (filledIdx.length < TARGET_LETTERS_MIN) {
    const usedLetters = new Set(filledIdx.map((index) => letters[index]));
    const extras: string[] = [];
    for (const letter of letterAt.values()) {
      if (!usedLetters.has(letter)) extras.push(letter);
    }
    const emptyIdx = letters
      .map((letter, index) => (!letter && !shape[index] ? index : -1))
      .filter((index) => index >= 0);
    let placed = filledIdx.length;
    for (let i = 0; i < emptyIdx.length && placed < TARGET_LETTERS_MIN; i++) {
      const extra = extras[i % Math.max(extras.length, 1)];
      if (!extra) break;
      letters[emptyIdx[i]] = extra;
      placed += 1;
    }
  }

  return {
    gridSize: `${rows}×${cols}`,
    shape,
    letters,
  };
}

export const FAV_PICK_ACCENTS = ['#6FD8B0', '#8B7CF6', '#F4603E', '#F2C14E', '#B3A6FF'] as const;

export type CardDifficulty = 'easy' | 'medium' | 'hard';

export function toCardDifficulty(difficulty: string | undefined): CardDifficulty {
  if (difficulty === 'easy') return 'easy';
  if (difficulty === 'hard' || difficulty === 'challenging' || difficulty === 'expert') {
    return 'hard';
  }
  return 'medium';
}
