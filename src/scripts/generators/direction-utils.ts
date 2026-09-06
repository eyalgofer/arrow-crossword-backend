import { Puzzle, PuzzleItem, Direction, ClueSlot } from '../core/types';

/** Virtual clue cell for answer/arrow geometry (exit for image clues). */
export function getClueAnchor(item: Pick<PuzzleItem, 'startRow' | 'startCol' | 'exitRow' | 'exitCol' | 'clueType'>): {
  row: number;
  col: number;
} {
  if (item.clueType === 'image' && item.exitRow != null && item.exitCol != null) {
    return { row: item.exitRow, col: item.exitCol };
  }
  return { row: item.startRow, col: item.startCol };
}

/** All 9 cells of a 3×3 image block whose top-left is (startRow, startCol). */
export function getImageBlockCells(startRow: number, startCol: number): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      cells.push({ row: startRow + dr, col: startCol + dc });
    }
  }
  return cells;
}

export function getAnswerCells(
  puzzleItem: PuzzleItem
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  const { direction, answer } = puzzleItem;
  const anchor = getClueAnchor(puzzleItem);
  
  // Determine starting position and direction of answer
  let answerStartRow = anchor.row;
  let answerStartCol = anchor.col;
  let rowDelta = 0;
  let colDelta = 0;
  
  switch (direction) {
    case 'across':
      // Clue cell, answer goes right starting from next column
      answerStartCol = anchor.col + 1;
      colDelta = 1;
      break;
    case 'down':
      // Clue cell, answer goes down starting from next row
      answerStartRow = anchor.row + 1;
      rowDelta = 1;
      break;
    case 'right-down':
      // Clue in cell, arrow points diagonally right-down
      // Answer starts at next column, same row, goes DOWN
      answerStartCol = anchor.col + 1;
      rowDelta = 1;
      break;
    case 'left-down':
      // Clue in cell, arrow points diagonally left-down
      // Answer starts at previous column, same row, goes DOWN
      answerStartCol = anchor.col - 1;
      answerStartRow = anchor.row; // Same row as clue, not next row
      rowDelta = 1;
      break;
    case 'down-across':
      // Clue in cell, arrow points down
      // Answer starts at same column, next row, goes RIGHT
      answerStartRow = anchor.row + 1;
      colDelta = 1;
      break;
    case 'up-across':
      // Clue in cell, arrow points up
      // Answer starts at same column, previous row, goes RIGHT
      answerStartRow = anchor.row - 1;
      colDelta = 1;
      break;
  }
  
  // Generate all cells the answer occupies
  // Remove spaces from answer for cell placement (spaces are not placed in grid)
  const answerWithoutSpaces = answer.replace(/\s+/g, '');
  for (let i = 0; i < answerWithoutSpaces.length; i++) {
    cells.push({
      row: answerStartRow + i * rowDelta,
      col: answerStartCol + i * colDelta
    });
  }
  
  return cells;
}

/** Cells that are neither a clue, an answer letter, nor part of a 3×3 image block. */
export function getUncoveredCells(puzzle: Puzzle): Array<{ row: number; col: number }> {
  const covered = new Set<string>();
  const cover = (row: number, col: number) => {
    if (row >= 0 && row < puzzle.grid.rows && col >= 0 && col < puzzle.grid.cols) {
      covered.add(`${row},${col}`);
    }
  };
  for (const item of puzzle.puzzleItems) {
    if (item.clueType === 'image' && item.exitRow != null && item.exitCol != null) {
      for (const cell of getImageBlockCells(item.startRow, item.startCol)) {
        cover(cell.row, cell.col);
      }
    } else {
      cover(item.startRow, item.startCol);
    }
    for (const cell of getAnswerCells(item)) {
      cover(cell.row, cell.col);
    }
  }
  const empty: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < puzzle.grid.rows; row++) {
    for (let col = 0; col < puzzle.grid.cols; col++) {
      if (!covered.has(`${row},${col}`)) empty.push({ row, col });
    }
  }
  return empty;
}

/**
 * Convert a template slot to cells.
 * If slot.cells is provided (e.g. from  Engel geometry), use it.
 */
export function getSlotCells(slot: ClueSlot): Array<{ row: number; col: number }> {
  if (slot.cells && slot.cells.length > 0) {
    return slot.cells;
  }

  const cells: Array<{ row: number; col: number }> = [];
  let rowDelta = 0;
  let colDelta = 0;
  const anchorRow = slot.clueType === 'image' && slot.exitRow != null ? slot.exitRow : slot.startRow;
  const anchorCol = slot.clueType === 'image' && slot.exitCol != null ? slot.exitCol : slot.startCol;
  let startRow = anchorRow;
  let startCol = anchorCol;

  // Adjust start based on direction (clue cell vs answer start)
  switch (slot.direction) {
    case 'across':
      startCol += 1;
      colDelta = 1;
      break;
    case 'down':
      startRow += 1;
      rowDelta = 1;
      break;
    case 'right-down':
      startCol += 1;
      rowDelta = 1;
      break;
    case 'left-down':
      startCol -= 1;
      // startRow stays the same (answer starts at same row as clue)
      rowDelta = 1;
      break;
    case 'down-across':
      startRow += 1;
      colDelta = 1;
      break;
    case 'up-across':
      startRow -= 1;
      colDelta = 1;
      break;
  }
  
  // Generate all cells the slot occupies
  for (let i = 0; i < slot.length; i++) {
    cells.push({
      row: startRow + i * rowDelta,
      col: startCol + i * colDelta
    });
  }
  
  return cells;
}

/**
 * Get the next cell in the same direction after the last answer cell
 * Returns null if the next cell would be out of bounds
 */
export function getNextCellAfterAnswer(
  direction: Direction,
  lastAnswerCell: { row: number; col: number },
  gridRows: number,
  gridCols: number
): { row: number; col: number } | null {
  let rowDelta = 0;
  let colDelta = 0;
  
  // Determine the direction delta based on the answer orientation
  switch (direction) {
    case 'across':
    case 'down-across':
    case 'up-across':
      colDelta = 1; // Horizontal answers continue to the right
      break;
    case 'down':
    case 'right-down':
    case 'left-down':
      rowDelta = 1; // Vertical answers continue downward
      break;
  }
  
  const nextRow = lastAnswerCell.row + rowDelta;
  const nextCol = lastAnswerCell.col + colDelta;
  
  // Check if next cell is out of bounds
  if (nextRow < 0 || nextRow >= gridRows || nextCol < 0 || nextCol >= gridCols) {
    return null; // Out of bounds - valid end point
  }
  
  return { row: nextRow, col: nextCol };
}

/**
 * Get the cell before the first answer cell (in the opposite direction)
 * Returns null if the previous cell would be out of bounds
 */
export function getCellBeforeAnswer(
  direction: Direction,
  firstAnswerCell: { row: number; col: number },
  gridRows: number,
  gridCols: number
): { row: number; col: number } | null {
  let rowDelta = 0;
  let colDelta = 0;
  
  // Determine the direction delta in the opposite direction
  switch (direction) {
    case 'across':
    case 'down-across':
    case 'up-across':
      colDelta = -1; // Horizontal answers come from the left
      break;
    case 'down':
    case 'right-down':
    case 'left-down':
      rowDelta = -1; // Vertical answers come from above
      break;
  }
  
  const prevRow = firstAnswerCell.row + rowDelta;
  const prevCol = firstAnswerCell.col + colDelta;
  
  // Check if previous cell is out of bounds
  if (prevRow < 0 || prevRow >= gridRows || prevCol < 0 || prevCol >= gridCols) {
    return null; // Out of bounds - valid start point
  }
  
  return { row: prevRow, col: prevCol };
}

/** First answer cell offset relative to the clue/exit anchor for a direction. */
export function getFirstAnswerOffset(direction: Direction): { rowDelta: number; colDelta: number; flowRow: number; flowCol: number } {
  switch (direction) {
    case 'across':
      return { rowDelta: 0, colDelta: 1, flowRow: 0, flowCol: 1 };
    case 'down':
      return { rowDelta: 1, colDelta: 0, flowRow: 1, flowCol: 0 };
    case 'right-down':
      return { rowDelta: 0, colDelta: 1, flowRow: 1, flowCol: 0 };
    case 'left-down':
      return { rowDelta: 0, colDelta: -1, flowRow: 1, flowCol: 0 };
    case 'down-across':
      return { rowDelta: 1, colDelta: 0, flowRow: 0, flowCol: 1 };
    case 'up-across':
      return { rowDelta: -1, colDelta: 0, flowRow: 0, flowCol: 1 };
  }
}
