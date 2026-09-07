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
  /** Typical letter count this exit can support (catalog-friendly 5–9). */
  answerLength: number;
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

function inBounds(row: number, col: number, rows: number, cols: number): boolean {
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

/**
 * Plan non-overlapping 3×3 image blocks with mixed →↓ exits and room for
 * a catalog-friendly answer (at least 5 letters before an edge or another image).
 */
export function planImageClues(
  rows: number,
  cols: number,
  count: number = 3,
  _preferredLengths: number[] = [8, 7, 6, 9, 5]
): PlannedImageClue[] {
  const placed: PlannedImageClue[] = [];
  const footprint = new Set<string>();
  const blocked = new Set<string>();

  const candidates: Array<{ startRow: number; startCol: number }> = [];
  for (let r = 1; r <= rows - 5; r++) {
    for (let c = 1; c <= cols - 5; c++) {
      candidates.push({ startRow: r, startCol: c });
    }
  }
  candidates.sort(() => Math.random() - 0.5);

  function isImageInterior(
    row: number,
    col: number,
    extra?: { startRow: number; startCol: number; exitRow: number; exitCol: number }
  ): boolean {
    const blocks = extra ? [...placed, extra] : placed;
    for (const block of blocks) {
      if (!isInsideBlock(row, col, block.startRow, block.startCol)) continue;
      if (row === block.exitRow && col === block.exitCol) continue;
      return true;
    }
    return false;
  }

  function maxRun(
    exitRow: number,
    exitCol: number,
    direction: Direction,
    extra: { startRow: number; startCol: number; exitRow: number; exitCol: number }
  ): number {
    const start = firstAnswerCell(exitRow, exitCol, direction);
    let n = 0;
    let r = start.row;
    let c = start.col;
    while (inBounds(r, c, rows, cols) && !blocked.has(`${r},${c}`) && !isImageInterior(r, c, extra)) {
      n += 1;
      r += start.flowRow;
      c += start.flowCol;
    }
    return n;
  }

  for (const block of candidates) {
    if (placed.length >= count) break;

    let overlaps = false;
    for (let dr = 0; dr < 3 && !overlaps; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        if (footprint.has(`${block.startRow + dr},${block.startCol + dc}`)) {
          overlaps = true;
          break;
        }
      }
    }
    if (overlaps) continue;

    const acrossCount = placed.filter((img) => img.direction === 'across').length;
    const downCount = placed.filter((img) => img.direction === 'down').length;
    let preferredDir: Direction;
    if (acrossCount >= 2 && downCount < 2) preferredDir = 'down';
    else if (downCount >= 2 && acrossCount < 2) preferredDir = 'across';
    else preferredDir = placed.length % 2 === 0 ? 'across' : 'down';
    const options = exitOptions(block.startRow, block.startCol).filter(
      (opt) => opt.direction === 'across' || opt.direction === 'down'
    );
    const ordered = [
      ...options.filter((opt) => opt.direction === preferredDir).sort(() => Math.random() - 0.5),
      ...options.filter((opt) => opt.direction !== preferredDir).sort(() => Math.random() - 0.5),
    ];
    const extra = {
      startRow: block.startRow,
      startCol: block.startCol,
      exitRow: block.startRow,
      exitCol: block.startCol,
    };

    let chosen: PlannedImageClue | null = null;
    for (const opt of ordered) {
      extra.exitRow = opt.exitRow;
      extra.exitCol = opt.exitCol;
      const first = firstAnswerCell(opt.exitRow, opt.exitCol, opt.direction);
      if (isInsideBlock(first.row, first.col, block.startRow, block.startCol)) continue;
      const available = maxRun(opt.exitRow, opt.exitCol, opt.direction, extra);
      if (available < 5) continue;
      chosen = {
        startRow: block.startRow,
        startCol: block.startCol,
        exitRow: opt.exitRow,
        exitCol: opt.exitCol,
        direction: opt.direction,
        fieldType: directionToFieldType(opt.direction),
        answerLength: Math.min(9, available),
      };
      break;
    }
    if (!chosen) continue;

    for (let dr = -1; dr < 4; dr++) {
      for (let dc = -1; dc < 4; dc++) {
        footprint.add(`${block.startRow + dr},${block.startCol + dc}`);
      }
    }
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        const row = block.startRow + dr;
        const col = block.startCol + dc;
        if (row === chosen.exitRow && col === chosen.exitCol) continue;
        blocked.add(`${row},${col}`);
      }
    }
    blocked.add(`${chosen.exitRow},${chosen.exitCol}`);
    const start = firstAnswerCell(chosen.exitRow, chosen.exitCol, chosen.direction);
    for (let i = 0; i < 3; i++) {
      blocked.add(`${start.row + i * start.flowRow},${start.col + i * start.flowCol}`);
    }

    placed.push(chosen);
  }

  return placed;
}
