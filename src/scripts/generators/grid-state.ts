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
 * Also validates that words don't merge (end when another letter follows)
 * CRITICAL: Words can only start/end after clue cells, locked cells, or grid boundaries
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
  
  // CRITICAL: Validate that words can only start/end after clue cells, locked cells, or grid boundaries
  // Check the cell BEFORE the first answer cell
  if (cells.length >= 2) {
    const firstCell = cells[0];
    const secondCell = cells[1];
    const rowDelta = secondCell.row - firstCell.row;
    const colDelta = secondCell.col - firstCell.col;
    
    // Calculate previous cell in the opposite direction
    const prevRow = firstCell.row - rowDelta;
    const prevCol = firstCell.col - colDelta;
    
    // Check if previous cell is out of bounds (valid start point)
    if (prevRow >= 0 && prevRow < state.rows && prevCol >= 0 && prevCol < state.cols) {
      // Previous cell is in bounds - must be either a clue cell or have a locked letter
      const prevCellKey = `${prevRow},${prevCol}`;
      if (state.clueCells.has(prevCellKey)) {
        // Previous cell is a clue cell - valid start point
      } else {
        const prevCellLetter = state.cells[prevRow][prevCol];
        // If previous cell has a letter, it must be locked (otherwise words would merge)
        // For now, we check if it's empty or a clue cell - locked cells are handled during solving
        // Empty is valid (will become a clue cell or remain empty)
        if (prevCellLetter !== null) {
          // Previous cell has a letter - this would merge words unless it's locked
          // During template generation, we can't check locked state, so we require it to be empty or clue cell
          // This validation is more strict during solving
          return false;
        }
      }
    }
    // If previous cell is out of bounds, that's a valid start point (grid boundary)
    
    // Check the cell AFTER the last answer cell
    const lastCell = cells[cells.length - 1];
    const nextRow = lastCell.row + rowDelta;
    const nextCol = lastCell.col + colDelta;
    
    // Check if next cell is out of bounds (valid end point)
    if (nextRow >= 0 && nextRow < state.rows && nextCol >= 0 && nextCol < state.cols) {
      // Next cell is in bounds - must be either a clue cell or have a locked letter
      const nextCellKey = `${nextRow},${nextCol}`;
      if (state.clueCells.has(nextCellKey)) {
        // Next cell is a clue cell - valid end point
      } else {
        const nextCellLetter = state.cells[nextRow][nextCol];
        // If next cell has a letter, it must be locked (otherwise words would merge)
        // For now, we check if it's empty or a clue cell - locked cells are handled during solving
        // Empty is valid (will become a clue cell or remain empty)
        if (nextCellLetter !== null) {
          // Next cell has a letter - words would merge, invalid!
          return false;
        }
        // Next cell is empty - valid (will remain empty or become a clue cell)
      }
    }
    // If next cell is out of bounds, that's a valid end point (grid boundary)
  }
  // For single-cell words (rare), skip this validation
  
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
