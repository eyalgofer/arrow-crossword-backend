/**
 * Grid State Management for Crossword Puzzles
 * 
 * Handles grid state representation and manipulation
 */

export interface GridState {
  rows: number;
  cols: number;
  cells: (string | null)[][]; // null = empty, string = letter
  clueCells: Set<string>; // "row,col" format
  placedWords: Map<string, string>; // slotId -> word
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
    placedWords: new Map()
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
  cells: Array<{ row: number; col: number }>
): GridState {
  // Clone the state
  const newCells = state.cells.map(row => [...row]);
  const newPlacedWords = new Map(state.placedWords);
  
  // Normalize word: remove spaces for grid placement (e.g., "TONY HAWK" -> "TONYHAWK")
  const normalized = word.replace(/\s+/g, '').toUpperCase();
  
  // Place each letter (using normalized word without spaces)
  for (let i = 0; i < normalized.length; i++) {
    const { row, col } = cells[i];
    newCells[row][col] = normalized[i];
  }
  
  // Store original word (with spaces if applicable) for answer field
  newPlacedWords.set(slotId, word);
  
  return {
    ...state,
    cells: newCells,
    placedWords: newPlacedWords
  };
}

/**
 * Check if a word can be placed without conflicts
 * Handles multi-word answers by removing spaces for grid placement
 */
export function canPlaceWord(
  state: GridState,
  word: string,
  cells: Array<{ row: number; col: number }>
): boolean {
  // Normalize word: remove spaces for grid placement (e.g., "TONY HAWK" -> "TONYHAWK")
  const normalized = word.replace(/\s+/g, '').toUpperCase();
  
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
