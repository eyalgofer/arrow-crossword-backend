import { Direction } from '../core/types';

export const IMAGE_CLUE_PLACEHOLDER_URL =
  'https://premierpups.com/azure/premierphotos/pups/french-bulldog-puppies-637637524473115475.jpg?w=557&h=557&mode=crop&autorotate=1';

export interface ImageClueCatalogEntry {
  answer: string;
  clue: string;
  imageUrl: string;
}

export const IMAGE_CLUE_CATALOG: ImageClueCatalogEntry[] = [
  { answer: 'ZORBAX', clue: 'IMAGE', imageUrl: IMAGE_CLUE_PLACEHOLDER_URL },
  { answer: 'QUIMPL', clue: 'IMAGE', imageUrl: IMAGE_CLUE_PLACEHOLDER_URL },
  { answer: 'FLEXTOR', clue: 'IMAGE', imageUrl: IMAGE_CLUE_PLACEHOLDER_URL },
  { answer: 'MIBRUK', clue: 'IMAGE', imageUrl: IMAGE_CLUE_PLACEHOLDER_URL },
  { answer: 'PLONDAK', clue: 'IMAGE', imageUrl: IMAGE_CLUE_PLACEHOLDER_URL },
  { answer: 'VEXTRI', clue: 'IMAGE', imageUrl: IMAGE_CLUE_PLACEHOLDER_URL },
];

export type ImageExitFieldType = '1' | '2' | '3' | '4' | '5' | '6';

export interface PlannedImageClue {
  startRow: number;
  startCol: number;
  exitRow: number;
  exitCol: number;
  direction: Direction;
  fieldType: ImageExitFieldType;
  imageUrl: string;
}

export function directionToFieldType(direction: Direction): ImageExitFieldType {
  switch (direction) {
    case 'across':
      return '1';
    case 'down':
      return '2';
    case 'right-down':
      return '3';
    case 'left-down':
      return '4';
    case 'down-across':
      return '5';
    case 'up-across':
      return '6';
  }
}

/** 3×3 minus exit cell — exit stays a real definition field. */
export function imageBlockCutouts(
  blocks: Array<{ startRow: number; startCol: number; exitRow: number; exitCol: number }>
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  for (const { startRow, startCol, exitRow, exitCol } of blocks) {
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        const row = startRow + dr;
        const col = startCol + dc;
        if (row === exitRow && col === exitCol) continue;
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

export function imageExitLocks(
  blocks: Array<{
    exitRow: number;
    exitCol: number;
    fieldType: ImageExitFieldType;
    direction: Direction;
  }>
): Array<{ row: number; col: number; type: ImageExitFieldType | '0' }> {
  const locks: Array<{ row: number; col: number; type: ImageExitFieldType | '0' }> = [];
  for (const b of blocks) {
    locks.push({ row: b.exitRow, col: b.exitCol, type: b.fieldType });
    const start = firstAnswerCell(b.exitRow, b.exitCol, b.direction);
    for (let i = 0; i < 3; i++) {
      locks.push({
        row: start.row + i * start.flowRow,
        col: start.col + i * start.flowCol,
        type: '0',
      });
    }
  }
  return locks;
}

function firstAnswerCell(
  exitRow: number,
  exitCol: number,
  direction: Direction
): { row: number; col: number; flowRow: number; flowCol: number } {
  switch (direction) {
    case 'across':
      return { row: exitRow, col: exitCol + 1, flowRow: 0, flowCol: 1 };
    case 'down':
      return { row: exitRow + 1, col: exitCol, flowRow: 1, flowCol: 0 };
    case 'right-down':
      return { row: exitRow, col: exitCol + 1, flowRow: 1, flowCol: 0 };
    case 'left-down':
      return { row: exitRow, col: exitCol - 1, flowRow: 1, flowCol: 0 };
    case 'down-across':
      return { row: exitRow + 1, col: exitCol, flowRow: 0, flowCol: 1 };
    case 'up-across':
      return { row: exitRow - 1, col: exitCol, flowRow: 0, flowCol: 1 };
  }
}

function isInsideBlock(
  row: number,
  col: number,
  startRow: number,
  startCol: number
): boolean {
  return (
    row >= startRow &&
    row <= startRow + 2 &&
    col >= startCol &&
    col <= startCol + 2
  );
}

/**
 * Every perimeter cell of the 3×3 × every direction whose first answer
 * lands on a neighbor *outside* the image (same geometry as text clues).
 * Across/down listed first so the planner prefers simple exits.
 */
function exitOptions(
  startRow: number,
  startCol: number
): Array<{ exitRow: number; exitCol: number; direction: Direction }> {
  const perimeter: Array<{ row: number; col: number }> = [];
  for (let dc = 0; dc < 3; dc++) {
    perimeter.push({ row: startRow, col: startCol + dc });
    perimeter.push({ row: startRow + 2, col: startCol + dc });
  }
  perimeter.push({ row: startRow + 1, col: startCol });
  perimeter.push({ row: startRow + 1, col: startCol + 2 });

  const preferred: Direction[] = ['across', 'down'];
  const angled: Direction[] = ['right-down', 'left-down', 'down-across', 'up-across'];
  const out: Array<{ exitRow: number; exitCol: number; direction: Direction }> = [];

  for (const direction of [...preferred, ...angled]) {
    for (const { row, col } of perimeter) {
      const first = firstAnswerCell(row, col, direction);
      if (isInsideBlock(first.row, first.col, startRow, startCol)) continue;
      out.push({ exitRow: row, exitCol: col, direction });
    }
  }
  return out;
}

/**
 * Plan non-overlapping 3×3 image blocks with locked exit + letter corridor.
 */
export function planImageClues(
  rows: number,
  cols: number,
  count: number = 3,
  catalog: ImageClueCatalogEntry[] = IMAGE_CLUE_CATALOG
): PlannedImageClue[] {
  const placed: PlannedImageClue[] = [];
  const occupied = new Set<string>();
  const shuffled = [...catalog].sort(() => Math.random() - 0.5);

  const candidates: Array<{ startRow: number; startCol: number }> = [];
  // Margin so exits + 3-letter corridors stay in-bounds
  for (let r = 1; r <= rows - 5; r++) {
    for (let c = 1; c <= cols - 5; c++) {
      candidates.push({ startRow: r, startCol: c });
    }
  }
  candidates.sort(() => Math.random() - 0.5);

  function runFits(
    exitRow: number,
    exitCol: number,
    direction: Direction,
    minLen: number
  ): boolean {
    const start = firstAnswerCell(exitRow, exitCol, direction);
    for (let i = 0; i < minLen; i++) {
      const r = start.row + i * start.flowRow;
      const c = start.col + i * start.flowCol;
      if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
      if (occupied.has(`${r},${c}`)) return false;
    }
    return true;
  }

  for (const block of candidates) {
    if (placed.length >= count) break;

    let overlaps = false;
    for (let dr = 0; dr < 3 && !overlaps; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        if (occupied.has(`${block.startRow + dr},${block.startCol + dc}`)) {
          overlaps = true;
          break;
        }
      }
    }
    if (overlaps) continue;

    // Prefer across/down (first N options); light shuffle within tiers
    const options = exitOptions(block.startRow, block.startCol);
    // 2 dirs × 8 perimeter = 16 preferred, then angled
    const primary = options.slice(0, 16).sort(() => Math.random() - 0.5);
    const secondary = options.slice(16).sort(() => Math.random() - 0.5);
    const ordered = [...primary, ...secondary];

    let chosen: (typeof options)[0] | null = null;
    for (const opt of ordered) {
      const first = firstAnswerCell(opt.exitRow, opt.exitCol, opt.direction);
      if (isInsideBlock(first.row, first.col, block.startRow, block.startCol)) continue;
      if (runFits(opt.exitRow, opt.exitCol, opt.direction, 3)) {
        chosen = opt;
        break;
      }
    }
    if (!chosen) continue;

    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        occupied.add(`${block.startRow + dr},${block.startCol + dc}`);
      }
    }
    const start = firstAnswerCell(chosen.exitRow, chosen.exitCol, chosen.direction);
    for (let i = 0; i < 3; i++) {
      occupied.add(`${start.row + i * start.flowRow},${start.col + i * start.flowCol}`);
    }

    const entry = shuffled[placed.length % shuffled.length];
    placed.push({
      startRow: block.startRow,
      startCol: block.startCol,
      exitRow: chosen.exitRow,
      exitCol: chosen.exitCol,
      direction: chosen.direction,
      fieldType: directionToFieldType(chosen.direction),
      imageUrl: entry.imageUrl,
    });
  }

  return placed;
}
