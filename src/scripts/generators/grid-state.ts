/**
 * Grid State Management for Crossword Puzzles
 * 
 * Handles grid state representation and manipulation
 */
import { normalizeWord, checkAnswerBoundariesWithDeltas } from './validation-utils';

export interface GridState {
  rows: number;
  cols: number;
  cells: (string | null)[][]; // null = empty, string = letter
  clueCells: Set<string>; // "row,col" format
  placedWords: Map<string, string>; // slotId -> word
  answerCells: Set<string>; // "row,col" format - tracks which cells are part of answer words
  answerCellToSlot: Map<string, string>; // "row,col" -> slotId - tracks which slot owns each answer cell
  slotDirections: Map<string, { rowDelta: number; colDelta: number }>; // slotId -> direction deltas
}

/**
 * Create an empty grid state
 */
export function createEmptyGridState(rows: number, cols: number): GridState {
  const cells: (string | null)[][]= [];
  for (let r = 0; r < rows; r++) {
    cells.push(new Array(cols).fill(null));
  }
  
  return {
    rows,
    cols,
    cells,
    clueCells: new Set(),
    placedWords: new Map(),
    answerCells: new Set(),
    answerCellToSlot: new Map(),
    slotDirections: new Map()
  };
}

/**
 * Get the letter at a position, or null if empty
 */
export function getLetterAt(state: GridState, row: number, col: number): string | null {
  if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) {
    return null;
  }
  return state.cells[row][col];
}

/**
 * Place a word in the grid and return a new state (immutable)
 * Handles multi-word answers by removing spaces for grid placement
 * Stores original word (with spaces) in placedWords for answer field
 */
export function placeWord(
  state: GridState,
  slotId: string,
  word: string,
  cells: Array<{ row: number; col: number }>,
  rowDelta: number = 0,
  colDelta: number = 0
): GridState {
  // Clone the state
  const newCells = state.cells.map(row => [...row]);
  const newPlacedWords = new Map(state.placedWords);
  const newAnswerCells = new Set(state.answerCells);
  const newAnswerCellToSlot = new Map(state.answerCellToSlot);
  const newSlotDirections = new Map(state.slotDirections);
  
  // Normalize word: remove spaces for grid placement (e.g., "TONY HAWK" -> "TONYHAWK")
  const normalized = normalizeWord(word);
  
  // Ensure we have enough cells for the normalized word (without spaces)
  if (normalized.length > cells.length) {
    throw new Error(`Cannot place word "${word}" (normalized: "${normalized}", length ${normalized.length}) in ${cells.length} cells`);
  }
  
  // Place each letter (using normalized word without spaces) and mark as answer cell
  // Only use exactly normalized.length cells to avoid leaving empty cells
  for (let i = 0; i < normalized.length && i < cells.length; i++) {
    const { row, col } = cells[i];
    newCells[row][col] = normalized[i];
    const cellKey = `${row},${col}`;
    newAnswerCells.add(cellKey);
    newAnswerCellToSlot.set(cellKey, slotId);
  }
  
  // Store direction deltas for this slot
  newSlotDirections.set(slotId, { rowDelta, colDelta });
  
  // Store original word (with spaces if applicable) for answer field
  newPlacedWords.set(slotId, word);
  
  return {
    ...state,
    cells: newCells,
    placedWords: newPlacedWords,
    answerCells: newAnswerCells,
    answerCellToSlot: newAnswerCellToSlot,
    slotDirections: newSlotDirections
  };
}

/**
 * Check if a word can be placed without conflicts
 * Handles multi-word answers by removing spaces for grid placement
 * Also validates that words don't merge (end when another letter follows)
 * Words can only start/end after clue cells, locked cells, or grid boundaries
 */
export function canPlaceWord(
  state: GridState,
  word: string,
  cells: Array<{ row: number; col: number }>,
  rowDelta?: number,
  colDelta?: number
): boolean {
  // Normalize word: remove spaces for grid placement (e.g., "TONY HAWK" -> "TONYHAWK")
  const normalized = normalizeWord(word);
  
  // Ensure we have enough cells for the normalized word
  if (normalized.length > cells.length) {
    return false;
  }
  
  for (let i = 0; i < normalized.length; i++) {
    const { row, col } = cells[i];
    
    // Check bounds
    if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) {
      return false;
    }
    
    // Check if cell is a clue cell
    if (state.clueCells.has(`${row},${col}`)) {
      return false;
    }
    
    // Check for letter conflicts (using normalized word)
    const existing = state.cells[row][col];
    if (existing !== null && existing !== normalized[i]) {
      return false;
    }
  }
  
  // Validate that words can only start/end at grid bounds, clue cells, or blocked cells
  // Words CANNOT start/end at answer cells in the same direction (would cause word merging)
  // Calculate direction deltas if not provided
  if (cells.length < 2) {
    // Single-cell words - skip validation
    return true;
  }
  
  const firstCell = cells[0];
  const secondCell = cells[1];
  const calculatedRowDelta = rowDelta !== undefined ? rowDelta : (secondCell.row - firstCell.row);
  const calculatedColDelta = colDelta !== undefined ? colDelta : (secondCell.col - firstCell.col);
  
  // Check boundaries to prevent word merging
  if (!checkAnswerBoundariesWithDeltas(cells, calculatedRowDelta, calculatedColDelta, state.rows, state.cols, state.answerCells)) {
    return false; // Would merge with another answer cell
  }
  
  // ADDITIONAL CHECK: Also check if any answer cell is adjacent to our word's start/end in the same row/column
  // This catches cases where words are adjacent horizontally or vertically but in different directions
  const lastCell = cells[cells.length - 1];
  if (calculatedRowDelta === 0 && calculatedColDelta !== 0) {
    // Horizontal word - check same row for adjacent answer cells
    for (const cellKey of state.answerCells) {
      const [row, col] = cellKey.split(',').map(Number);
      if (row === firstCell.row) {
        const isCrossing = cells.some(c => c.row === row && c.col === col);
        if (!isCrossing && (col === firstCell.col - 1 || col === lastCell.col + 1)) {
          return false; // Adjacent in same row but not a crossing - invalid!
        }
      }
    }
  } else if (calculatedRowDelta !== 0 && calculatedColDelta === 0) {
    // Vertical word - check same column for adjacent answer cells
    for (const cellKey of state.answerCells) {
      const [row, col] = cellKey.split(',').map(Number);
      if (col === firstCell.col) {
        const isCrossing = cells.some(c => c.row === row && c.col === col);
        if (!isCrossing && (row === firstCell.row - 1 || row === lastCell.row + 1)) {
          return false; // Adjacent in same column but not a crossing - invalid!
        }
      }
    }
  }
  
  return true;
}

/**
 * Get crossing constraints from the current grid state
 */
export function getCrossingConstraints(
  state: GridState,
  cells: Array<{ row: number; col: number }>
): Map<number, string> {
  const constraints = new Map<number, string>();
  
  for (let i = 0; i < cells.length; i++) {
    const { row, col } = cells[i];
    const letter = getLetterAt(state, row, col);
    if (letter !== null) {
      constraints.set(i, letter);
    }
  }
  
  return constraints;
}
