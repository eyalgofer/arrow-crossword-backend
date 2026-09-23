import { Direction, GridTemplate, Puzzle, PuzzleItem } from '../core/types';
import { getAnswerCells, getSlotCells } from './direction-utils';

const HORIZONTAL_DIRS = new Set<Direction>(['across', 'down-across', 'up-across']);
const SIMPLE_DIRS = new Set<Direction>(['across', 'down']);

export const MIN_TEMPLATE_CROSSING = 0.48;
export const MIN_PUZZLE_CROSSING = 0.5;
/** Match image/daily boards — 4 kinds was starving fill on text packages. */
export const MIN_TEMPLATE_KINDS = 3;
export const MIN_PUZZLE_KINDS = 3;
export const MIN_AXIS_SHARE = 0.22;

/** Dense Hebrew text boards: rival-style interlocking + dual packing. */
export const DENSE_STRETCH_CROSSING = 0.85;
/** Simple-arrow boards cannot cross top-row/left-col letters; 0.85 is the stretch. */
export const DENSE_MIN_TEMPLATE_CROSSING = 0.62;
export const DENSE_MIN_PUZZLE_CROSSING = 0.65;
export const DENSE_MIN_KINDS = 2;
export const DENSE_MIN_DUAL_RATIO = 0;
export const DENSE_MIN_SIMPLE_ARROW_SHARE = 0.85;
export const DENSE_MAX_TWO_LETTER_SHARE = 0.15;

/** Daily boards: rival-style — nearly every clue block holds two clues, nearly every letter crossed. */
export const DAILY_MIN_DUAL_RATIO = 0.8;
export const DAILY_MIN_CROSSING = 0.9;
export const DAILY_MAX_ORPHAN_WORDS = 0;
/** Frame letters between two clue blocks stay single (Swedish frame); words must still interlock. */
export const DAILY_MAX_WEAK_WORDS = 0;

export type Quadrant = 'NW' | 'NE' | 'SW' | 'SE';

export interface LengthHistogram {
  len2: number;
  len3to5: number;
  len6to8: number;
  len9plus: number;
}

export interface QualityStats {
  crossingRatio: number;
  letterCells: number;
  crossedCells: number;
  uncrossedCells: number;
  /** Words where no letter is shared with another word. */
  orphanWords: number;
  /** Letters on the outer frame covered by only one word. */
  edgeUncrossed: number;
  /** Words where fewer than half the letters are shared with another word. */
  weakWords: number;
  directionKinds: number;
  kinds: Direction[];
  horizontalShare: number;
  verticalShare: number;
  shortSlots: number;
  twoLetterSlots: number;
  longSlots: number;
  slotCount: number;
  dualClueCells: number;
  textClueCells: number;
  dualRatio: number;
  simpleArrowShare: number;
  lengths: LengthHistogram;
  imageQuadrants: Quadrant[];
  imagesOpposite: boolean;
}

export interface QualityThresholds {
  minCrossing: number;
  minKinds: number;
  minAxisShare?: number;
  requireOppositeImages?: boolean;
  allowTwoLetter?: boolean;
  maxTwoLetterShare?: number;
  minDualRatio?: number;
  minSimpleArrowShare?: number;
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
  let twoLetterSlots = 0;
  let longSlots = 0;
  let simpleSlots = 0;
  const lengths: LengthHistogram = { len2: 0, len3to5: 0, len6to8: 0, len9plus: 0 };

  for (const slot of slots) {
    kinds.add(slot.direction);
    if (HORIZONTAL_DIRS.has(slot.direction)) horizontal += 1;
    else vertical += 1;
    if (SIMPLE_DIRS.has(slot.direction)) simpleSlots += 1;
    if (slot.length < 2) shortSlots += 1;
    if (slot.length === 2) twoLetterSlots += 1;
    if (slot.length > 8) longSlots += 1;
    if (slot.length === 2) lengths.len2 += 1;
    else if (slot.length <= 5) lengths.len3to5 += 1;
    else if (slot.length <= 8) lengths.len6to8 += 1;
    else lengths.len9plus += 1;
    for (const cell of slot.cells) {
      const key = cellKey(cell.row, cell.col);
      letterToCount.set(key, (letterToCount.get(key) ?? 0) + 1);
    }
  }

  let crossedCells = 0;
  let edgeUncrossed = 0;
  for (const [key, count] of letterToCount) {
    if (count >= 2) {
      crossedCells += 1;
      continue;
    }
    const [row, col] = key.split(',').map(Number);
    if (row === 0 || col === 0 || row === grid.rows - 1 || col === grid.cols - 1) {
      edgeUncrossed += 1;
    }
  }
  let orphanWords = 0;
  let weakWords = 0;
  for (const slot of slots) {
    const crossed = slot.cells.filter(
      (cell) => (letterToCount.get(cellKey(cell.row, cell.col)) ?? 0) >= 2
    ).length;
    if (crossed === 0) orphanWords += 1;
    if (crossed * 2 < slot.cells.length) weakWords += 1;
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
  const textClueCells = cluePos.size;
  const imageQuadrants = images.map((img) =>
    quadrantOf(img.startRow + 1, img.startCol + 1, grid.rows, grid.cols)
  );

  return {
    crossingRatio: letterCells === 0 ? 0 : crossedCells / letterCells,
    letterCells,
    crossedCells,
    uncrossedCells: Math.max(0, letterCells - crossedCells),
    orphanWords,
    edgeUncrossed,
    weakWords,
    directionKinds: kinds.size,
    kinds: [...kinds],
    horizontalShare: total === 0 ? 0 : horizontal / total,
    verticalShare: total === 0 ? 0 : vertical / total,
    shortSlots,
    twoLetterSlots,
    longSlots,
    slotCount: slots.length,
    dualClueCells,
    textClueCells,
    dualRatio: textClueCells === 0 ? 0 : dualClueCells / textClueCells,
    simpleArrowShare: slots.length === 0 ? 0 : simpleSlots / slots.length,
    lengths,
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
  if (thresholds.allowTwoLetter) {
    const cap = thresholds.maxTwoLetterShare ?? DENSE_MAX_TWO_LETTER_SHARE;
    if (stats.slotCount > 0 && stats.twoLetterSlots / stats.slotCount > cap) return false;
  } else if (stats.twoLetterSlots > 0) {
    return false;
  }
  if (stats.slotCount > 0 && stats.longSlots / stats.slotCount > 0.25) return false;
  if (thresholds.minDualRatio !== undefined && stats.dualRatio < thresholds.minDualRatio) {
    return false;
  }
  if (
    thresholds.minSimpleArrowShare !== undefined &&
    stats.simpleArrowShare < thresholds.minSimpleArrowShare
  ) {
    return false;
  }
  if (thresholds.requireOppositeImages && stats.imageQuadrants.length >= 2 && !stats.imagesOpposite) {
    return false;
  }
  return true;
}

export function templateQualityOk(
  stats: QualityStats,
  imageCount: number,
  dense = false
): boolean {
  if (dense && imageCount === 0) {
    return qualityOk(stats, {
      minCrossing: DENSE_MIN_TEMPLATE_CROSSING,
      minKinds: DENSE_MIN_KINDS,
      minAxisShare: 0.2,
      allowTwoLetter: true,
      maxTwoLetterShare: DENSE_MAX_TWO_LETTER_SHARE,
      minDualRatio: DENSE_MIN_DUAL_RATIO,
      minSimpleArrowShare: DENSE_MIN_SIMPLE_ARROW_SHARE,
    });
  }
  return qualityOk(stats, {
    minCrossing: imageCount > 0 ? 0.5 : MIN_TEMPLATE_CROSSING,
    minKinds: imageCount > 0 ? 3 : MIN_TEMPLATE_KINDS,
    minAxisShare: 0.2,
    requireOppositeImages: imageCount >= 2,
  });
}

export function puzzleQualityOk(
  stats: QualityStats,
  imageCount: number,
  dense = false
): boolean {
  if (dense && imageCount === 0) {
    return qualityOk(stats, {
      minCrossing: DENSE_MIN_PUZZLE_CROSSING,
      minKinds: DENSE_MIN_KINDS,
      minAxisShare: 0.2,
      allowTwoLetter: true,
      maxTwoLetterShare: DENSE_MAX_TWO_LETTER_SHARE,
      minDualRatio: DENSE_MIN_DUAL_RATIO,
      minSimpleArrowShare: DENSE_MIN_SIMPLE_ARROW_SHARE,
    });
  }
  return qualityOk(stats, {
    minCrossing: imageCount > 0 ? 0.48 : MIN_PUZZLE_CROSSING,
    minKinds: imageCount > 0 ? 3 : MIN_PUZZLE_KINDS,
    minAxisShare: 0.2,
    requireOppositeImages: imageCount >= 2,
  });
}

export interface DailyTargets {
  minDualRatio: number;
  minCrossing: number;
  maxOrphanWords: number;
  maxWeakWords: number;
}

export const DAILY_TARGETS: DailyTargets = {
  minDualRatio: DAILY_MIN_DUAL_RATIO,
  minCrossing: DAILY_MIN_CROSSING,
  maxOrphanWords: DAILY_MAX_ORPHAN_WORDS,
  maxWeakWords: DAILY_MAX_WEAK_WORDS,
};

/** 3×3 image blocks break the frame lattice, so image boards carry a few more single-clue blocks. */
export const DAILY_IMAGE_TARGETS: DailyTargets = {
  ...DAILY_TARGETS,
  minDualRatio: 0.7,
  minCrossing: 0.88,
};

export function dailyTargetsFor(imageCount: number): DailyTargets {
  return imageCount > 0 ? DAILY_IMAGE_TARGETS : DAILY_TARGETS;
}

/** Human-readable reasons a board misses the daily targets; empty when it meets them. */
export function dailyTargetMisses(stats: QualityStats, targets: DailyTargets = DAILY_TARGETS): string[] {
  const misses: string[] = [];
  if (stats.dualRatio < targets.minDualRatio) {
    misses.push(`dual ${stats.dualRatio.toFixed(2)} < ${targets.minDualRatio}`);
  }
  if (stats.crossingRatio < targets.minCrossing) {
    misses.push(`cross ${stats.crossingRatio.toFixed(2)} < ${targets.minCrossing}`);
  }
  if (stats.orphanWords > targets.maxOrphanWords) {
    misses.push(`orphans ${stats.orphanWords} > ${targets.maxOrphanWords}`);
  }
  if (stats.weakWords > targets.maxWeakWords) {
    misses.push(`weak-words ${stats.weakWords} > ${targets.maxWeakWords}`);
  }
  return misses;
}

export function formatQuality(stats: QualityStats): string {
  const kinds = stats.kinds.join(',') || '-';
  const quads = stats.imageQuadrants.length > 0 ? ` imgs=${stats.imageQuadrants.join('+')}` : '';
  const { len2, len3to5, len6to8, len9plus } = stats.lengths;
  return (
    `cross=${stats.crossingRatio.toFixed(2)} ` +
    `(${stats.crossedCells}/${stats.letterCells} unx=${stats.uncrossedCells} ` +
    `edge=${stats.edgeUncrossed} orphan=${stats.orphanWords} weak=${stats.weakWords}) ` +
    `kinds=${stats.directionKinds}[${kinds}] ` +
    `h=${stats.horizontalShare.toFixed(2)} v=${stats.verticalShare.toFixed(2)} ` +
    `dual=${stats.dualClueCells}/${stats.textClueCells}=${stats.dualRatio.toFixed(2)} ` +
    `simple=${stats.simpleArrowShare.toFixed(2)} ` +
    `len=2:${len2},3-5:${len3to5},6-8:${len6to8},9+:${len9plus}` +
    quads
  );
}

/** Shuffle a copy — used when rebinding image catalog candidates. */
export function shuffled<T>(items: T[]): T[] {
  return shuffleInPlace([...items]);
}
