import fs from 'fs';
import path from 'path';
import { Direction } from '../core/types';
import { normalizeWord } from './validation-utils';
import { Quadrant, quadrantOf } from './puzzle-quality';

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
    startRow: number;
    startCol: number;
    exitRow: number;
    exitCol: number;
    fieldType: ImageExitFieldType;
    direction: Direction;
    answerLength?: number;
  }>
): Array<{ row: number; col: number; type: ImageExitFieldType | '0' }> {
  const locks: Array<{ row: number; col: number; type: ImageExitFieldType | '0' }> = [];
  for (const b of blocks) {
    locks.push({ row: b.exitRow, col: b.exitCol, type: b.fieldType });
    const start = firstAnswerCell(b.exitRow, b.exitCol, b.direction);
    // Protect only the first few letters so repair can still place a splitter
    // at the catalog target length (5–8). Full-length protection made image
    // words run to the edge (>9) and bind failed, while locked stoppers
    // created unfixable short words.
    const protectedLetters = 4;
    for (let i = 0; i < protectedLetters; i++) {
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

const ALL_IMAGE_DIRS: Direction[] = [
  'across',
  'down',
  'right-down',
  'left-down',
  'down-across',
  'up-across',
];

/** Prefer straight arrows for image exits — bent exits over-constrain the CSP. */
const PREFERRED_IMAGE_DIRS: Direction[] = ['across', 'down', 'down-across', 'up-across'];

type ImageQuadrant = Quadrant;

const OPPOSITE_QUAD: Record<ImageQuadrant, ImageQuadrant> = {
  NW: 'SE',
  NE: 'SW',
  SW: 'NE',
  SE: 'NW',
};

function shuffleCopy<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Every perimeter cell of the 3×3 × every direction whose first answer
 * lands on a neighbor *outside* the image (same geometry as text clues).
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

  const out: Array<{ exitRow: number; exitCol: number; direction: Direction }> = [];
  for (const direction of ALL_IMAGE_DIRS) {
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

/** Prefer true corners / edges — newspaper תשחץ puts photo blocks there. */
function cornerBias(
  startRow: number,
  startCol: number,
  rows: number,
  cols: number,
  quad: ImageQuadrant
): number {
  const maxR = rows - 3;
  const maxC = cols - 3;
  const distCorner =
    quad === 'NW'
      ? startRow + startCol
      : quad === 'NE'
        ? startRow + (maxC - startCol)
        : quad === 'SW'
          ? (maxR - startRow) + startCol
          : (maxR - startRow) + (maxC - startCol);
  return distCorner;
}

function candidatesInQuadrant(
  quad: ImageQuadrant,
  rows: number,
  cols: number
): Array<{ startRow: number; startCol: number }> {
  const cells: Array<{ startRow: number; startCol: number }> = [];
  // Allow row/col 0 so photos can sit in absolute corners (like the references).
  for (let r = 0; r <= rows - 3; r++) {
    for (let c = 0; c <= cols - 3; c++) {
      if (quadrantOf(r + 1, c + 1, rows, cols) === quad) {
        cells.push({ startRow: r, startCol: c });
      }
    }
  }
  cells.sort(
    (a, b) =>
      cornerBias(a.startRow, a.startCol, rows, cols, quad) -
        cornerBias(b.startRow, b.startCol, rows, cols, quad) ||
      Math.random() - 0.5
  );
  // Keep a little randomness among the best ~8 corner candidates.
  const head = cells.slice(0, Math.min(8, cells.length));
  const tail = cells.slice(8);
  return [...shuffleCopy(head), ...shuffleCopy(tail)];
}

function placementOrder(count: number): ImageQuadrant[] {
  const first = shuffleCopy<ImageQuadrant>(['NW', 'NE', 'SW', 'SE'])[0];
  if (count <= 1) return [first];
  const order: ImageQuadrant[] = [first, OPPOSITE_QUAD[first]];
  const rest = shuffleCopy<ImageQuadrant>(['NW', 'NE', 'SW', 'SE']).filter(
    (quad) => !order.includes(quad)
  );
  while (order.length < count && rest.length > 0) {
    order.push(rest.shift()!);
  }
  return order;
}

/**
 * Plan non-overlapping 3×3 image blocks in opposite quadrants with mixed
 * arrow exits and room for a catalog-friendly answer (5–9 letters).
 */
export function planImageClues(
  rows: number,
  cols: number,
  count: number = 3,
  preferredLengths: number[] = [7, 6, 5]
): PlannedImageClue[] {
  const placed: PlannedImageClue[] = [];
  const footprint = new Set<string>();
  const blocked = new Set<string>();
  const quads = placementOrder(count);
  const lengthPrefs =
    preferredLengths.length > 0 ? preferredLengths : [7, 6, 5];

  function pickAnswerLength(available: number): number | null {
    if (available < 5) return null;
    // Prefer 5–7 (dense pools); allow 8 when needed.
    const prefs = lengthPrefs.filter((len) => len >= 5 && len <= 8);
    const ordered = prefs.length > 0 ? prefs : [7, 6, 5, 8];
    for (const len of ordered) {
      if (len <= available) return len;
    }
    return Math.min(8, available);
  }

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

  function tryPlace(block: { startRow: number; startCol: number }): PlannedImageClue | null {
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        if (footprint.has(`${block.startRow + dr},${block.startCol + dc}`)) return null;
      }
    }

    const usedDirs = new Set(placed.map((img) => img.direction));
    const options = exitOptions(block.startRow, block.startCol);
    const rankDir = (d: Direction) => {
      const pref = PREFERRED_IMAGE_DIRS.indexOf(d);
      return pref === -1 ? 100 : pref;
    };
    const unused = shuffleCopy(options.filter((opt) => !usedDirs.has(opt.direction)));
    const used = shuffleCopy(options.filter((opt) => usedDirs.has(opt.direction)));
    unused.sort((a, b) => rankDir(a.direction) - rankDir(b.direction));
    used.sort((a, b) => rankDir(a.direction) - rankDir(b.direction));
    const ordered = [...unused, ...used];
    const extra = {
      startRow: block.startRow,
      startCol: block.startCol,
      exitRow: block.startRow,
      exitCol: block.startCol,
    };

    let fallback: PlannedImageClue | null = null;
    for (const opt of ordered) {
      extra.exitRow = opt.exitRow;
      extra.exitCol = opt.exitCol;
      const first = firstAnswerCell(opt.exitRow, opt.exitCol, opt.direction);
      if (!inBounds(first.row, first.col, rows, cols)) continue;
      if (isInsideBlock(first.row, first.col, block.startRow, block.startCol)) continue;
      const available = maxRun(opt.exitRow, opt.exitCol, opt.direction, extra);
      const answerLength = pickAnswerLength(available);
      if (answerLength == null) continue;
      const candidate: PlannedImageClue = {
        startRow: block.startRow,
        startCol: block.startCol,
        exitRow: opt.exitRow,
        exitCol: opt.exitCol,
        direction: opt.direction,
        fieldType: directionToFieldType(opt.direction),
        answerLength,
      };
      // Prefer catalog-rich mid lengths (5–7).
      if (answerLength >= 5 && answerLength <= 7) return candidate;
      if (!fallback) fallback = candidate;
    }
    return fallback;
  }

  function commit(chosen: PlannedImageClue): void {
    for (let dr = -1; dr < 4; dr++) {
      for (let dc = -1; dc < 4; dc++) {
        footprint.add(`${chosen.startRow + dr},${chosen.startCol + dc}`);
      }
    }
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        const row = chosen.startRow + dr;
        const col = chosen.startCol + dc;
        if (row === chosen.exitRow && col === chosen.exitCol) continue;
        blocked.add(`${row},${col}`);
      }
    }
    blocked.add(`${chosen.exitRow},${chosen.exitCol}`);
    const start = firstAnswerCell(chosen.exitRow, chosen.exitCol, chosen.direction);
    // Reserve room for a 5–8 letter image answer (planner + repair will terminate).
    const corridor = Math.min(Math.max(chosen.answerLength, 5), 8);
    for (let i = 0; i < corridor; i++) {
      blocked.add(`${start.row + i * start.flowRow},${start.col + i * start.flowCol}`);
    }
    placed.push(chosen);
  }

  for (const quad of quads) {
    if (placed.length >= count) break;
    for (const block of candidatesInQuadrant(quad, rows, cols)) {
      const chosen = tryPlace(block);
      if (!chosen) continue;
      commit(chosen);
      break;
    }
  }

  if (placed.length < count) {
    const takenQuads = new Set(
      placed.map((img) => quadrantOf(img.startRow + 1, img.startCol + 1, rows, cols))
    );
    const preferQuads = new Set(
      [...takenQuads].map((quad) => OPPOSITE_QUAD[quad])
    );
    const fallback: Array<{ startRow: number; startCol: number; rank: number }> = [];
    for (let r = 0; r <= rows - 3; r++) {
      for (let c = 0; c <= cols - 3; c++) {
        const quad = quadrantOf(r + 1, c + 1, rows, cols);
        const edge =
          r === 0 || c === 0 || r === rows - 3 || c === cols - 3 ? 0 : 1;
        const rank =
          (preferQuads.has(quad) ? 0 : takenQuads.has(quad) ? 2 : 1) * 10 + edge;
        fallback.push({ startRow: r, startCol: c, rank });
      }
    }
    fallback.sort((a, b) => a.rank - b.rank || Math.random() - 0.5);
    for (const block of fallback) {
      if (placed.length >= count) break;
      const chosen = tryPlace(block);
      if (chosen) commit(chosen);
    }
  }

  return placed;
}
