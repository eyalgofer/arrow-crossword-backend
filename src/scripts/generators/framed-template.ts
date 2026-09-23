/**
 * Framed dual-clue templates for daily boards (Swedish / rival-style תשחץ).
 *
 * Layout:
 *   - Top row and first column alternate clue blocks and letters. Each frame block
 *     holds two clues (a straight arrow into its own line and a bent arrow into the
 *     neighbouring one), so every edge word still crosses the rest of the board.
 *   - Interior clue blocks are placed only where they start both a horizontal and a
 *     vertical word, breaking long runs into 3–7 letter words.
 *   - Arrows are assigned by matching every letter run to an adjacent clue block
 *     (at most two clues per block).
 *
 * Internal coordinates are LTR like the rest of the generator; the client mirrors Hebrew.
 */

import { ClueSlot, Difficulty, Direction, GridTemplate } from '../core/types';
import { validateSlotsBoundaries } from './validation-utils';
import { rebuildSlotCrossings } from './template-generator';

type ArrowType = '1' | '2' | '3' | '4' | '5' | '6';
type Kind = 'L' | 'C' | 'X';

const ARROW_TO_DIRECTION: Record<ArrowType, Direction> = {
  '1': 'across',
  '2': 'down',
  '3': 'right-down',
  '4': 'left-down',
  '5': 'down-across',
  '6': 'up-across',
};

const STRAIGHT = new Set<ArrowType>(['1', '2']);

export interface FramedTemplateOptions {
  rows: number;
  cols: number;
  name?: string;
  difficulty?: Difficulty;
  /** Image-block interiors (3×3 minus exit). */
  cutoutCells?: Array<{ row: number; col: number }>;
  /** Image exits (arrow type) and protected letters ('0'). */
  lockedCells?: Array<{ row: number; col: number; type: string }>;
  minSlotLength?: number;
  maxSlotLength?: number;
  /** Runs longer than this are split (per attempt, 6 or 7 by default). */
  targetMaxLength?: number;
  maxTwoLetterShare?: number;
  attempts?: number;
}

interface Run {
  horizontal: boolean;
  cells: Array<{ row: number; col: number }>;
}

interface Anchor {
  row: number;
  col: number;
  type: ArrowType;
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

class Board {
  readonly kinds: Kind[][];
  constructor(
    readonly rows: number,
    readonly cols: number,
    readonly protectedLetters: Set<string>,
    readonly lockedArrows: Map<string, ArrowType>
  ) {
    this.kinds = Array.from({ length: rows }, () => Array<Kind>(cols).fill('L'));
  }

  inBounds(row: number, col: number): boolean {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  isLetter(row: number, col: number): boolean {
    return this.inBounds(row, col) && this.kinds[row][col] === 'L';
  }

  isClue(row: number, col: number): boolean {
    return this.inBounds(row, col) && this.kinds[row][col] === 'C';
  }

  canBecomeClue(row: number, col: number): boolean {
    const key = `${row},${col}`;
    return this.isLetter(row, col) && !this.protectedLetters.has(key);
  }

  /** Maximal letter runs (length >= 1) in both directions. */
  runs(): Run[] {
    const out: Run[] = [];
    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        if (!this.isLetter(r, c)) {
          c++;
          continue;
        }
        const cells: Run['cells'] = [];
        while (this.isLetter(r, c)) cells.push({ row: r, col: c++ });
        out.push({ horizontal: true, cells });
      }
    }
    for (let c = 0; c < this.cols; c++) {
      let r = 0;
      while (r < this.rows) {
        if (!this.isLetter(r, c)) {
          r++;
          continue;
        }
        const cells: Run['cells'] = [];
        while (this.isLetter(r, c)) cells.push({ row: r++, col: c });
        out.push({ horizontal: false, cells });
      }
    }
    return out;
  }

  /** Length of the letter run through (row, col) before and after it along one axis. */
  pieces(row: number, col: number, horizontal: boolean): [number, number] {
    const dr = horizontal ? 0 : 1;
    const dc = horizontal ? 1 : 0;
    let before = 0;
    while (this.isLetter(row - dr * (before + 1), col - dc * (before + 1))) before++;
    let after = 0;
    while (this.isLetter(row + dr * (after + 1), col + dc * (after + 1))) after++;
    return [before, after];
  }

  /** Clue positions that could hold the arrow for a run, straight arrows first. */
  anchors(run: Run): Anchor[] {
    const { row, col } = run.cells[0];
    const options: Anchor[] = run.horizontal
      ? [
          { row, col: col - 1, type: '1' },
          { row: row - 1, col, type: '5' },
          { row: row + 1, col, type: '6' },
        ]
      : [
          { row: row - 1, col, type: '2' },
          { row, col: col - 1, type: '3' },
          { row, col: col + 1, type: '4' },
        ];
    return options.filter((a) => {
      if (!this.isClue(a.row, a.col)) return false;
      const locked = this.lockedArrows.get(`${a.row},${a.col}`);
      return !locked || locked === a.type;
    });
  }
}

function paintFrame(board: Board): void {
  const setClue = (row: number, col: number) => {
    if (board.canBecomeClue(row, col)) board.kinds[row][col] = 'C';
  };
  for (let c = 0; c < board.cols; c += 2) setClue(0, c);
  for (let r = 2; r < board.rows; r += 2) setClue(r, 0);
}

/** A split is acceptable when every resulting piece is either empty or >= min letters. */
function pieceOk(length: number, min: number): boolean {
  return length === 0 || length >= min;
}

function breakLongRuns(board: Board, targetMax: number, minLen: number, allowSingles = false): boolean {
  const perpendicularMin = allowSingles ? 1 : 2;
  for (let guard = 0; guard < board.rows * board.cols; guard++) {
    const long = board.runs().filter((run) => run.cells.length > targetMax);
    if (long.length === 0) return true;
    const run = shuffle(long).sort((a, b) => b.cells.length - a.cells.length)[0];

    let best: { row: number; col: number; score: number } | null = null;
    for (let i = 0; i < run.cells.length; i++) {
      const { row, col } = run.cells[i];
      if (!board.canBecomeClue(row, col)) continue;
      const before = i;
      const after = run.cells.length - i - 1;
      // Both halves stay real words, so the block that clued this run keeps its clue.
      if (before < minLen || after < minLen) continue;
      const [pBefore, pAfter] = board.pieces(row, col, !run.horizontal);
      if (!pieceOk(pBefore, perpendicularMin) || !pieceOk(pAfter, perpendicularMin)) continue;

      const dr = run.horizontal ? 1 : 0;
      const dc = run.horizontal ? 0 : 1;
      // pBefore === 0 steals the start of a perpendicular word from the block behind it.
      const stealsPerpendicular = pBefore === 0 && board.isClue(row - dr, col - dc);

      let score = Math.random() * 1.5;
      if (pAfter >= 2) score += 4; // dual: starts a word on both axes
      if (pBefore === 1 || pAfter === 1) score -= 6;
      if (stealsPerpendicular) score -= 5;
      if (pieceOk(pBefore, 3) && pieceOk(pAfter, 3)) score += 1.5;
      if (before >= 3 && after >= 3) score += 1;
      score -= Math.abs(before - after) * 0.15;
      if (!best || score > best.score) best = { row, col, score };
    }
    if (!best) return false;
    board.kinds[best.row][best.col] = 'C';
  }
  return false;
}

/** A letter can become a clue block without leaving 1-letter pieces on either axis. */
function safeToBlock(board: Board, row: number, col: number): boolean {
  if (!board.canBecomeClue(row, col)) return false;
  const [hb, ha] = board.pieces(row, col, true);
  const [vb, va] = board.pieces(row, col, false);
  return [hb, ha, vb, va].every((n) => pieceOk(n, 2));
}

/**
 * Runs no clue can reach (typically right after an image block): put a clue block on
 * their first letter, or beside it where a bent arrow can reach the run.
 */
function healUnanchored(board: Board, minLen: number): boolean {
  for (let guard = 0; guard < 40; guard++) {
    const orphan = board
      .runs()
      .find((run) => run.cells.length >= 2 && board.anchors(run).length === 0);
    if (!orphan) return true;
    const { row, col } = orphan.cells[0];
    const rest = orphan.cells.length - 1;
    const beside = orphan.horizontal
      ? [
          { row: row - 1, col },
          { row: row + 1, col },
        ]
      : [
          { row, col: col - 1 },
          { row, col: col + 1 },
        ];
    const options = [
      ...(board.canBecomeClue(row, col) && (rest >= minLen || rest === 1) ? [{ row, col }] : []),
      ...shuffle(beside.filter((cell) => safeToBlock(board, cell.row, cell.col))),
    ];
    if (options.length === 0) return false;
    board.kinds[options[0].row][options[0].col] = 'C';
  }
  return false;
}

type Assignment = Map<number, Anchor>; // run index → anchor

/** Kuhn matching with capacity: each clue block holds at most two clues. */
function matchRuns(board: Board, runs: Run[], indices: number[]): Assignment | null {
  const owners = new Map<string, number[]>();
  const assigned: Assignment = new Map();
  const tryAssign = (runIdx: number, seen: Set<string>): boolean => {
    for (const anchor of board.anchors(runs[runIdx])) {
      const key = `${anchor.row},${anchor.col}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const current = owners.get(key) ?? [];
      if (current.length < 2) {
        owners.set(key, [...current, runIdx]);
        assigned.set(runIdx, anchor);
        return true;
      }
      for (let i = 0; i < current.length; i++) {
        if (tryAssign(current[i], seen)) {
          const next = [...(owners.get(key) ?? current)];
          next[next.indexOf(current[i])] = runIdx;
          owners.set(key, next);
          assigned.set(runIdx, anchor);
          return true;
        }
      }
    }
    return false;
  };
  for (const idx of indices) {
    if (!tryAssign(idx, new Set())) return null;
  }
  return assigned;
}

/** Give every clue block at least one clue by shifting words along alternating paths. */
function fillEmptyClues(board: Board, runs: Run[], assignment: Assignment): boolean {
  const keyOf = (a: Anchor) => `${a.row},${a.col}`;
  const clueKeys: string[] = [];
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) if (board.isClue(r, c)) clueKeys.push(`${r},${c}`);
  }

  for (let guard = 0; guard < clueKeys.length * 2; guard++) {
    const load = new Map<string, number>();
    for (const anchor of assignment.values()) load.set(keyOf(anchor), (load.get(keyOf(anchor)) ?? 0) + 1);
    const empty = clueKeys.find((key) => !load.has(key));
    if (!empty) return true;

    // BFS over alternating paths: a block takes a run from its owner; the chain ends
    // at an owner that still keeps another clue.
    const [er, ec] = empty.split(',').map(Number);
    type Step = { clue: string; runIdx: number; anchor: Anchor; prev: Step | null };
    const queue: Step[] = [];
    const visited = new Set<string>([empty]);
    const candidatesFor = (row: number, col: number, horizontal: boolean): Array<{ runIdx: number; anchor: Anchor }> => {
      const out: Array<{ runIdx: number; anchor: Anchor }> = [];
      runs.forEach((run, idx) => {
        if (run.horizontal !== horizontal || !assignment.has(idx)) return;
        const anchor = board.anchors(run).find((a) => a.row === row && a.col === col);
        if (anchor) out.push({ runIdx: idx, anchor });
      });
      return out;
    };
    for (const horizontal of [true, false]) {
      for (const cand of candidatesFor(er, ec, horizontal)) {
        queue.push({ clue: empty, runIdx: cand.runIdx, anchor: cand.anchor, prev: null });
      }
    }
    let done: Step | null = null;
    while (queue.length > 0 && !done) {
      const step = queue.shift()!;
      const ownerAnchor = assignment.get(step.runIdx)!;
      const ownerKey = keyOf(ownerAnchor);
      if ((load.get(ownerKey) ?? 0) >= 2) {
        done = step;
        break;
      }
      if (visited.has(ownerKey)) continue;
      visited.add(ownerKey);
      // The owner just lost its only clue, so it may take a run on either axis.
      for (const horizontal of [true, false]) {
        for (const cand of candidatesFor(ownerAnchor.row, ownerAnchor.col, horizontal)) {
          if (cand.runIdx === step.runIdx) continue;
          queue.push({ clue: ownerKey, runIdx: cand.runIdx, anchor: cand.anchor, prev: step });
        }
      }
    }
    if (!done) return false;
    for (let step: Step | null = done; step; step = step.prev) {
      assignment.set(step.runIdx, step.anchor);
    }
  }
  return false;
}

function buildOnce(options: Required<Pick<FramedTemplateOptions, 'rows' | 'cols'>> & FramedTemplateOptions): {
  slots: ClueSlot[];
} | null {
  const { rows, cols } = options;
  const minLen = options.minSlotLength ?? 2;
  const maxLen = options.maxSlotLength ?? 8;
  const targetMax = Math.min(maxLen, options.targetMaxLength ?? (Math.random() < 0.5 ? 6 : 7));

  const protectedLetters = new Set<string>();
  const lockedArrows = new Map<string, ArrowType>();
  for (const lock of options.lockedCells ?? []) {
    if (lock.type === '0') protectedLetters.add(`${lock.row},${lock.col}`);
    else lockedArrows.set(`${lock.row},${lock.col}`, lock.type as ArrowType);
  }
  const board = new Board(rows, cols, protectedLetters, lockedArrows);
  for (const { row, col } of options.cutoutCells ?? []) board.kinds[row][col] = 'X';
  for (const key of lockedArrows.keys()) {
    const [r, c] = key.split(',').map(Number);
    board.kinds[r][c] = 'C';
  }

  paintFrame(board);
  if (!healUnanchored(board, minLen)) return null;
  if (!breakLongRuns(board, targetMax, Math.max(3, minLen))) {
    if (!breakLongRuns(board, maxLen, minLen, true)) return null;
  }
  // Letters boxed in on both axes (usually beside an image) become clue blocks.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!board.isLetter(r, c)) continue;
      const [hb, ha] = board.pieces(r, c, true);
      const [vb, va] = board.pieces(r, c, false);
      if (hb + ha === 0 && vb + va === 0 && board.canBecomeClue(r, c)) board.kinds[r][c] = 'C';
    }
  }
  if (!healUnanchored(board, minLen)) return null;

  const runs = board.runs();
  // Letters with no word in either direction cannot be clued.
  const covered = new Set<string>();
  for (const run of runs) {
    if (run.cells.length < 2) continue;
    for (const cell of run.cells) covered.add(`${cell.row},${cell.col}`);
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board.isLetter(r, c) && !covered.has(`${r},${c}`)) return null;
    }
  }

  const words = runs.map((run, idx) => ({ run, idx })).filter(({ run }) => run.cells.length >= 2);
  if (words.some(({ run }) => run.cells.length > maxLen || run.cells.length < minLen)) return null;
  const twoLetter = words.filter(({ run }) => run.cells.length === 2).length;
  if (twoLetter / words.length > (options.maxTwoLetterShare ?? 0.1)) return null;

  const assignment = matchRuns(board, runs, words.map((w) => w.idx));
  if (!assignment) return null;
  if (!fillEmptyClues(board, runs, assignment)) return null;

  // Locked image exits must carry exactly their locked arrow.
  for (const [key, type] of lockedArrows) {
    const used = [...assignment.values()].some((a) => `${a.row},${a.col}` === key && a.type === type);
    if (!used) return null;
  }

  // Row-major numbering; in a two-clue block the clue whose arrow leaves downward is
  // listed second so it renders in the bottom half of the block.
  const bottomExit = (type: ArrowType) => (type === '2' || type === '5' ? 1 : 0);
  const ordered = words
    .map((w) => ({ ...w, anchor: assignment.get(w.idx)! }))
    .sort(
      (a, b) =>
        a.anchor.row - b.anchor.row ||
        a.anchor.col - b.anchor.col ||
        bottomExit(a.anchor.type) - bottomExit(b.anchor.type)
    );
  const slots: ClueSlot[] = [];
  let index = 0;
  for (const { run, anchor } of ordered) {
    slots.push({
      id: `slot_${index++}`,
      direction: ARROW_TO_DIRECTION[anchor.type],
      startRow: anchor.row,
      startCol: anchor.col,
      length: run.cells.length,
      crossings: [],
      cells: run.cells.map((cell) => ({ ...cell })),
    });
  }
  return { slots };
}

function dualRatio(slots: ClueSlot[]): number {
  const perCell = new Map<string, number>();
  for (const slot of slots) {
    const key = `${slot.startRow},${slot.startCol}`;
    perCell.set(key, (perCell.get(key) ?? 0) + 1);
  }
  let duals = 0;
  for (const n of perCell.values()) if (n >= 2) duals++;
  return perCell.size === 0 ? 0 : duals / perCell.size;
}

function layoutScore(slots: ClueSlot[]): number {
  const twoLetter = slots.filter((s) => s.length === 2).length;
  const bent = slots.filter((s) => !STRAIGHT.has(directionToArrow(s.direction))).length;
  const long = slots.filter((s) => s.length >= 7).length;
  return dualRatio(slots) * 100 - twoLetter * 3 - bent * 0.5 - long * 0.5 + Math.random();
}

function directionToArrow(direction: Direction): ArrowType {
  return (Object.keys(ARROW_TO_DIRECTION) as ArrowType[]).find((k) => ARROW_TO_DIRECTION[k] === direction)!;
}

/**
 * Build the best of `attempts` framed layouts; null when none satisfies the constraints
 * (usually image blocks in awkward spots — callers retry with a new image plan).
 */
export function generateFramedTemplate(options: FramedTemplateOptions): GridTemplate | null {
  const attempts = options.attempts ?? 60;
  let best: { slots: ClueSlot[]; score: number } | null = null;
  for (let i = 0; i < attempts; i++) {
    const built = buildOnce(options);
    if (!built) continue;
    const boundary = validateSlotsBoundaries(built.slots, options.rows, options.cols);
    if (!boundary.valid) continue;
    const score = layoutScore(built.slots);
    if (!best || score > best.score) best = { slots: built.slots, score };
  }
  if (!best) return null;
  rebuildSlotCrossings(best.slots);
  return {
    id: `template_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    name: options.name ?? `${options.rows}x${options.cols} framed arrow crossword`,
    rows: options.rows,
    cols: options.cols,
    slots: best.slots,
    clueCells: best.slots.map((slot) => ({
      row: slot.startRow,
      col: slot.startCol,
      direction: slot.direction,
    })),
    difficulty: options.difficulty ?? Difficulty.MEDIUM,
    categories: ['Generated'],
    metadata: { generationMethod: 'framed-dual' },
  };
}
