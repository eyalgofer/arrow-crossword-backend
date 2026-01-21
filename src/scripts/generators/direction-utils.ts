/**
 * Direction Utilities for Swedish Arrow Crossword Puzzles
 * 
 * Handles direction-related calculations and conversions
 */

import { Clue, Direction, ClueSlot } from '../core/types';

/**
 * Get the cells that an answer occupies based on clue direction
 */
export function getAnswerCells(
  clue: Clue
): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  const { startRow, startCol, direction, answer } = clue;
  
  // Determine starting position and direction of answer
  let answerStartRow = startRow;
  let answerStartCol = startCol;
  let rowDelta = 0;
  let colDelta = 0;
  
  switch (direction) {
    case 'across':
      // Clue cell, answer goes right starting from next column
      answerStartCol = startCol + 1;
      colDelta = 1;
      break;
    case 'down':
      // Clue cell, answer goes down starting from next row
      answerStartRow = startRow + 1;
      rowDelta = 1;
      break;
    case 'right-down':
      // Clue in cell, arrow points diagonally right-down
      // Answer starts at next column, same row, goes DOWN
      answerStartCol = startCol + 1;
      rowDelta = 1;
      break;
    case 'left-down':
      // Clue in cell, arrow points diagonally left-down
      // Answer starts at previous column, next row, goes DOWN
      answerStartCol = startCol - 1;
      answerStartRow = startRow + 1;
      rowDelta = 1;
      break;
    case 'down-across':
      // Clue in cell, arrow points down
      // Answer starts at same column, next row, goes RIGHT
      answerStartRow = startRow + 1;
      colDelta = 1;
      break;
    case 'up-across':
      // Clue in cell, arrow points up
      // Answer starts at same column, previous row, goes RIGHT
      answerStartRow = startRow - 1;
      colDelta = 1;
      break;
  }
  
  // Generate all cells the answer occupies
  for (let i = 0; i < answer.length; i++) {
    cells.push({
      row: answerStartRow + i * rowDelta,
      col: answerStartCol + i * colDelta
    });
  }
  
  return cells;
}

/**
 * Determine if a direction produces a horizontal or vertical answer
 */
export function getAnswerOrientation(direction: Direction): 'horizontal' | 'vertical' {
  switch (direction) {
    case 'across':
    case 'down-across':
    case 'up-across':
      return 'horizontal';
    case 'down':
    case 'right-down':
    case 'left-down':
      return 'vertical';
  }
}

/**
 * Convert a template slot to cells
 */
export function getSlotCells(slot: ClueSlot): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  
  let rowDelta = 0;
  let colDelta = 0;
  let startRow = slot.startRow;
  let startCol = slot.startCol;
  
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
      startRow += 1;
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
