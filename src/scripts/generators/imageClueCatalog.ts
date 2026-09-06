import fs from 'fs';
import path from 'path';
import { Direction } from '../core/types';
import { normalizeWord } from './validation-utils';

export interface ImageClueCatalogEntry {
  id?: string;
  answer: string;
  imageUrl: string;
  subject?: string;
  type?: string;
  letterLength?: number;
}

const GENERATED_CATALOG = path.join(__dirname, 'imageClues.generated.json');

export function catalogLetterLength(entry: ImageClueCatalogEntry): number {
  return entry.letterLength ?? normalizeWord(entry.answer).length;
}

export function loadGeneratedImageClueCatalog(): ImageClueCatalogEntry[] {
  if (!fs.existsSync(GENERATED_CATALOG)) return [];
  const raw = JSON.parse(fs.readFileSync(GENERATED_CATALOG, 'utf8')) as ImageClueCatalogEntry[];
  return raw.filter((entry) => entry.answer && entry.imageUrl);
}

export async function loadImageClueCatalogFromMongo(): Promise<ImageClueCatalogEntry[]> {
  const { ImageClue } = await import('../../models/ImageClue');
  const docs = await ImageClue.find({
    active: true,
    image_url: { $exists: true, $nin: [null, ''] },
    answer_hebrew: { $exists: true, $nin: [null, ''] },
  }).lean();
  return docs.map((doc) => ({
    id: doc.id,
    answer: doc.answer_hebrew,
    imageUrl: doc.image_url,
    subject: doc.subject,
    type: doc.type,
    letterLength: doc.letter_length ?? normalizeWord(doc.answer_hebrew).length,
  }));
}

export type ImageExitFieldType = '1' | '2' | '3' | '4' | '5' | '6';

export interface PlannedImageClue {
  startRow: number;
  startCol: number;
  exitRow: number;
  exitCol: number;
  direction: Direction;
  fieldType: ImageExitFieldType;
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

export function isInImageBlock(
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
  const out: Array<{ exitRow: number; exitCol: number; direction: Direction }> = [];

  for (const direction of preferred) {
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
  count: number = 3
): PlannedImageClue[] {
  const placed: PlannedImageClue[] = [];
  const occupied = new Set<string>();

  const candidates: Array<{ startRow: number; startCol: number }> = [];
  // Margin so the 3×3 block and a 3-letter exit corridor stay in-bounds
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

    // Shuffle within across/down vs angled so boards mix like a normal תשחץ
    const options = exitOptions(block.startRow, block.startCol);
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

    for (let dr = -1; dr < 4; dr++) {
      for (let dc = -1; dc < 4; dc++) {
        occupied.add(`${block.startRow + dr},${block.startCol + dc}`);
      }
    }
    const start = firstAnswerCell(chosen.exitRow, chosen.exitCol, chosen.direction);
    for (let i = 0; i < 3; i++) {
      occupied.add(`${start.row + i * start.flowRow},${start.col + i * start.flowCol}`);
    }

    placed.push({
      startRow: block.startRow,
      startCol: block.startCol,
      exitRow: chosen.exitRow,
      exitCol: chosen.exitCol,
      direction: chosen.direction,
      fieldType: directionToFieldType(chosen.direction),
    });
  }

  return placed;
}
