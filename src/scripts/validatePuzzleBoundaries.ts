import { getAnswerCells, getNextCellAfterAnswer } from './generators/direction-utils';

export function validatePuzzleBoundaries(puzzle: any): string[] {
  const rows: number = puzzle.grid?.rows;
  const cols: number = puzzle.grid?.cols;
  const items: any[] = puzzle.puzzleItems || [];
  const blockedCellsInput: Array<{ row: number; col: number }> = puzzle.grid?.blockedCells || [];

  const clueCellPositions = new Set<string>();
  for (const item of items) {
    clueCellPositions.add(`${item.startRow},${item.startCol}`);
  }

  const blockedCellPositions = new Set<string>();
  for (const bc of blockedCellsInput) {
    blockedCellPositions.add(`${bc.row},${bc.col}`);
  }

  const answerCellPositions = new Set<string>();
  for (const item of items) {
    const cells = getAnswerCells(item);
    for (const cell of cells) {
      answerCellPositions.add(`${cell.row},${cell.col}`);
    }
  }

  // Answer cells must not include any clue cell (question cell in answer placement)
  const errors: string[] = [];
  for (const item of items) {
    const answerCells = getAnswerCells(item);
    for (const cell of answerCells) {
      const key = `${cell.row},${cell.col}`;
      if (clueCellPositions.has(key) && (item.startRow !== cell.row || item.startCol !== cell.col)) {
        errors.push(
          `Clue #${item.number} "${item.clue}" (${item.direction}): answer cell (${cell.row},${cell.col}) is a clue cell from another clue`
        );
      }
    }
  }

  // Compute blocked cells: cells that are neither clue nor answer
  const computedBlockedCells = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      if (!clueCellPositions.has(key) && !answerCellPositions.has(key)) {
        computedBlockedCells.add(key);
      }
    }
  }

  for (const item of items) {
    const answerCells = getAnswerCells(item);
    if (answerCells.length === 0) continue;

    const lastCell = answerCells[answerCells.length - 1];
    const nextCellAfter = getNextCellAfterAnswer(item.direction, lastCell, rows, cols);

    if (nextCellAfter === null) {
      continue;
    }

    const nextCellKey = `${nextCellAfter.row},${nextCellAfter.col}`;

    if (answerCellPositions.has(nextCellKey)) {
      const conflictingClues: number[] = [];
      for (const other of items) {
        if (other.number === item.number) continue;
        const otherCells = getAnswerCells(other);
        for (const cell of otherCells) {
          if (cell.row === nextCellAfter.row && cell.col === nextCellAfter.col) {
            conflictingClues.push(other.number);
            break;
          }
        }
      }
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

