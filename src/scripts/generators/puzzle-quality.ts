import { Direction, GridTemplate, Puzzle, PuzzleItem } from '../core/types';
import { getAnswerCells, getSlotCells } from './direction-utils';

const HORIZONTAL_DIRS = new Set<Direction>(['across', 'down-across', 'up-across']);

export const MIN_TEMPLATE_CROSSING = 0.5;
export const MIN_PUZZLE_CROSSING = 0.55;
export const MIN_TEMPLATE_KINDS = 4;
export const MIN_PUZZLE_KINDS = 4;
export const MIN_AXIS_SHARE = 0.22;

export type Quadrant = 'NW' | 'NE' | 'SW' | 'SE';

export interface QualityStats {
  crossingRatio: number;
  letterCells: number;
  crossedCells: number;
  directionKinds: number;
  kinds: Direction[];
  horizontalShare: number;
  verticalShare: number;
  shortSlots: number;
  longSlots: number;
  slotCount: number;
  dualClueCells: number;
  imageQuadrants: Quadrant[];
  imagesOpposite: boolean;
}

export interface QualityThresholds {
  minCrossing: number;
  minKinds: number;
  minAxisShare?: number;
  requireOppositeImages?: boolean;
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function quadrantOf(row: number, col: number, rows: number, cols: number): Quadrant {
  const midR = (rows - 1) / 2;
  const midC = (cols - 1) / 2;
  const ns = row < midR ? 'N' : 'S';
  const ew = col < midC ? 'W' : 'E';
  return `${ns}${ew}` as Quadrant;
}

export function imagesAreOpposite(quadrants: Quadrant[]): boolean {
  if (quadrants.length < 2) return true;
  const set = new Set(quadrants);
  return (set.has('NW') && set.has('SE')) || (set.has('NE') && set.has('SW'));
}

function scoreFromSlots(
  slots: Array<{
    direction: Direction;
    length: number;
    cells: Array<{ row: number; col: number }>;
    startRow?: number;
    startCol?: number;
    clueType?: string;
  }>,
  grid: { rows: number; cols: number },
  images: Array<{ startRow: number; startCol: number }> = []
): QualityStats {
  const letterToCount = new Map<string, number>();
  let horizontal = 0;
  let vertical = 0;
  const kinds = new Set<Direction>();
  let shortSlots = 0;
  let longSlots = 0;

  for (const slot of slots) {
    kinds.add(slot.direction);
    if (HORIZONTAL_DIRS.has(slot.direction)) horizontal += 1;
    else vertical += 1;
    if (slot.length < 3) shortSlots += 1;
    if (slot.length > 8) longSlots += 1;
    for (const cell of slot.cells) {
      const key = cellKey(cell.row, cell.col);
      letterToCount.set(key, (letterToCount.get(key) ?? 0) + 1);
    }
  }

  let crossedCells = 0;
  for (const count of letterToCount.values()) {
    if (count >= 2) crossedCells += 1;
  }
  const letterCells = letterToCount.size;
  const total = horizontal + vertical;
  const cluePos = new Map<string, number>();
  for (const slot of slots) {
    if (slot.clueType === 'image' || slot.startRow == null || slot.startCol == null) continue;
    const key = cellKey(slot.startRow, slot.startCol);
    cluePos.set(key, (cluePos.get(key) ?? 0) + 1);
  }
  let dualClueCells = 0;
  for (const count of cluePos.values()) {
    if (count >= 2) dualClueCells += 1;
  }
  const imageQuadrants = images.map((img) =>
    quadrantOf(img.startRow + 1, img.startCol + 1, grid.rows, grid.cols)
  );

  return {
    crossingRatio: letterCells === 0 ? 0 : crossedCells / letterCells,
    letterCells,
    crossedCells,
    directionKinds: kinds.size,
    kinds: [...kinds],
    horizontalShare: total === 0 ? 0 : horizontal / total,
    verticalShare: total === 0 ? 0 : vertical / total,
    shortSlots,
    longSlots,
    slotCount: slots.length,
    dualClueCells,
    imageQuadrants,
    imagesOpposite: imagesAreOpposite(imageQuadrants),
  };
}

export function scoreTemplate(template: GridTemplate): QualityStats {
  const images = template.slots
    .filter((slot) => slot.clueType === 'image')
    .map((slot) => ({ startRow: slot.startRow, startCol: slot.startCol }));
  return scoreFromSlots(
    template.slots.map((slot) => ({
      direction: slot.direction,
      length: slot.length,
      cells: slot.cells && slot.cells.length > 0 ? slot.cells : getSlotCells(slot),
      startRow: slot.startRow,
      startCol: slot.startCol,
      clueType: slot.clueType,
    })),
    { rows: template.rows, cols: template.cols },
    images
  );
}

export function scorePuzzle(puzzle: Puzzle): QualityStats {
  const images = puzzle.puzzleItems
    .filter((item) => item.clueType === 'image')
    .map((item) => ({ startRow: item.startRow, startCol: item.startCol }));
  return scoreFromSlots(
    puzzle.puzzleItems.map((item: PuzzleItem) => ({
      direction: item.direction,
      length: item.answer.replace(/\s+/g, '').length,
      cells: getAnswerCells(item),
      startRow: item.startRow,
      startCol: item.startCol,
      clueType: item.clueType,
    })),
    puzzle.grid,
    images
  );
}

export function qualityOk(stats: QualityStats, thresholds: QualityThresholds): boolean {
  const minAxis = thresholds.minAxisShare ?? MIN_AXIS_SHARE;
  if (stats.crossingRatio < thresholds.minCrossing) return false;
  if (stats.directionKinds < thresholds.minKinds) return false;
  if (stats.horizontalShare < minAxis || stats.verticalShare < minAxis) return false;
  if (stats.shortSlots > 0) return false;
  if (stats.slotCount > 0 && stats.longSlots / stats.slotCount > 0.25) return false;
  if (thresholds.requireOppositeImages && stats.imageQuadrants.length >= 2 && !stats.imagesOpposite) {
    return false;
  }
  return true;
}

export function templateQualityOk(stats: QualityStats, imageCount: number): boolean {
  return qualityOk(stats, {
    minCrossing: imageCount > 0 ? 0.5 : MIN_TEMPLATE_CROSSING,
    minKinds: imageCount > 0 ? 3 : MIN_TEMPLATE_KINDS,
    minAxisShare: 0.2,
    requireOppositeImages: imageCount >= 2,
  });
}

export function puzzleQualityOk(stats: QualityStats, imageCount: number): boolean {
  return qualityOk(stats, {
    minCrossing: imageCount > 0 ? 0.52 : MIN_PUZZLE_CROSSING,
    minKinds: imageCount > 0 ? 3 : MIN_PUZZLE_KINDS,
    minAxisShare: 0.2,
    requireOppositeImages: imageCount >= 2,
  });
}

export function formatQuality(stats: QualityStats): string {
  const kinds = stats.kinds.join(',') || '-';
  const quads = stats.imageQuadrants.length > 0 ? ` imgs=${stats.imageQuadrants.join('+')}` : '';
  return (
    `cross=${stats.crossingRatio.toFixed(2)} ` +
    `(${stats.crossedCells}/${stats.letterCells}) ` +
    `kinds=${stats.directionKinds}[${kinds}] ` +
    `h=${stats.horizontalShare.toFixed(2)} v=${stats.verticalShare.toFixed(2)} ` +
    `dual=${stats.dualClueCells}` +
    quads
  );
}

/** Shuffle a copy — used when rebinding image catalog candidates. */
export function shuffled<T>(items: T[]): T[] {
  return shuffleInPlace([...items]);
}
