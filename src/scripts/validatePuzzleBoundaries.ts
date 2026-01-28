import { getAnswerCells, getNextCellAfterAnswer } from './generators/direction-utils';

type CellKey = string; // Format: "row,col"

function createCellKey(row: number, col: number): CellKey {
  return `${row},${col}`;
}

function buildCellSets(items: any[], blockedCellsInput: Array<{ row: number; col: number }>) {
  const clueCellPositions = new Set<CellKey>();
  const answerCellPositions = new Set<CellKey>();
  const blockedCellPositions = new Set<CellKey>();

  for (const item of items) {
    clueCellPositions.add(createCellKey(item.startRow, item.startCol));
    for (const cell of getAnswerCells(item)) {
      answerCellPositions.add(createCellKey(cell.row, cell.col));
    }
  }

  for (const bc of blockedCellsInput) {
    blockedCellPositions.add(createCellKey(bc.row, bc.col));
  }

  return { clueCellPositions, answerCellPositions, blockedCellPositions };
}

function computeBlockedCells(rows: number, cols: number, clueCells: Set<CellKey>, answerCells: Set<CellKey>): Set<CellKey> {
  const computed = new Set<CellKey>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = createCellKey(r, c);
      if (!clueCells.has(key) && !answerCells.has(key)) {
        computed.add(key);
      }
    }
  }
  return computed;
}

function findConflictingClues(nextCell: { row: number; col: number }, items: any[], currentItemNumber: number): number[] {
  const conflicting: number[] = [];
  for (const other of items) {
    if (other.number === currentItemNumber) continue;
    const otherCells = getAnswerCells(other);
    if (otherCells.some(cell => cell.row === nextCell.row && cell.col === nextCell.col)) {
      conflicting.push(other.number);
    }
  }
  return conflicting;
}

export function validatePuzzleBoundaries(puzzle: any): string[] {
  const rows: number = puzzle.grid?.rows;
  const cols: number = puzzle.grid?.cols;
  const items: any[] = puzzle.puzzleItems || [];
  const blockedCellsInput: Array<{ row: number; col: number }> = puzzle.grid?.blockedCells || [];

  const { clueCellPositions, answerCellPositions, blockedCellPositions } = buildCellSets(items, blockedCellsInput);
  const computedBlockedCells = computeBlockedCells(rows, cols, clueCellPositions, answerCellPositions);

  const errors: string[] = [];

  // Check answer cells don't overlap with clue cells from other clues
  for (const item of items) {
    for (const cell of getAnswerCells(item)) {
      const key = createCellKey(cell.row, cell.col);
      if (clueCellPositions.has(key) && (item.startRow !== cell.row || item.startCol !== cell.col)) {
        errors.push(
          `Clue #${item.number} "${item.clue}" (${item.direction}): answer cell (${cell.row},${cell.col}) is a clue cell from another clue`
        );
      }
    }
  }

  // Check boundary rule: cell after last answer must be clue/block/boundary
  for (const item of items) {
    const answerCells = getAnswerCells(item);
    if (answerCells.length === 0) continue;

    const lastCell = answerCells[answerCells.length - 1];
    const nextCellAfter = getNextCellAfterAnswer(item.direction, lastCell, rows, cols);
    if (nextCellAfter === null) continue;

    const nextCellKey = createCellKey(nextCellAfter.row, nextCellAfter.col);

    if (answerCellPositions.has(nextCellKey)) {
      const conflictingClues = findConflictingClues(nextCellAfter, items, item.number);
      errors.push(
        `Clue #${item.number} "${item.clue}" (${item.direction}, answer="${item.answer}"): cell after last answer (${nextCellAfter.row},${nextCellAfter.col}) is an answer cell from clue(s) ${conflictingClues.join(', ')}`
      );
      continue;
    }

    if (!clueCellPositions.has(nextCellKey) && !blockedCellPositions.has(nextCellKey) && !computedBlockedCells.has(nextCellKey)) {
      errors.push(
        `Clue #${item.number} "${item.clue}" (${item.direction}): cell after last answer (${nextCellAfter.row},${nextCellAfter.col}) is not clue/block/boundary`
      );
    }
  }

  return errors;
}

