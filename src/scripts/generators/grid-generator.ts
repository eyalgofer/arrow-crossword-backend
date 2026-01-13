/**
 * Grid Generator for Swedish Arrow Crossword Puzzles
 * 
 * Uses constraint satisfaction with backtracking to fill puzzle grids
 * with valid words that satisfy all crossing constraints.
 */

import { 
  Puzzle, 
  Clue, 
  Direction, 
  GridTemplate,
  ClueSlot,
  Difficulty
} from '../core/types';

// ============================================================================
// DIRECTION UTILITIES
// ============================================================================

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

// ============================================================================
// CROSSING INDEX - Pre-computed for fast lookup
// ============================================================================

export interface CrossingIndex {
  // letter -> position -> list of words with that letter at that position (normalized, no spaces)
  byLetterPosition: Map<string, Map<number, string[]>>;
  // word length -> list of words (normalized, no spaces)
  byLength: Map<number, string[]>;
  // normalized word (no spaces) -> original word (with spaces if applicable)
  originalWords: Map<string, string>;
}

/**
 * Build a crossing index from a word list for O(1) lookups
 * Handles multi-word answers by normalizing (removing spaces) for grid placement
 */
export function buildCrossingIndex(words: string[]): CrossingIndex {
  const byLetterPosition = new Map<string, Map<number, string[]>>();
  const byLength = new Map<number, string[]>();
  const originalWords = new Map<string, string>();
  
  for (const originalWord of words) {
    // Normalize: remove spaces for grid placement (e.g., "TONY HAWK" -> "TONYHAWK")
    const normalized = originalWord.replace(/\s+/g, '').toUpperCase();
    
    // Store mapping from normalized to original
    originalWords.set(normalized, originalWord);
    
    // Index by normalized length (without spaces)
    if (!byLength.has(normalized.length)) {
      byLength.set(normalized.length, []);
    }
    byLength.get(normalized.length)!.push(normalized);
    
    // Index by letter at each position (using normalized word)
    for (let pos = 0; pos < normalized.length; pos++) {
      const letter = normalized[pos];
      
      if (!byLetterPosition.has(letter)) {
        byLetterPosition.set(letter, new Map());
      }
      
      const posMap = byLetterPosition.get(letter)!;
      if (!posMap.has(pos)) {
        posMap.set(pos, []);
      }
      posMap.get(pos)!.push(normalized);
    }
  }
  
  return { byLetterPosition, byLength, originalWords };
}

/**
 * Find words that match given constraints
 * Returns original words (with spaces if applicable) for use in answer field
 */
export function findMatchingWords(
  index: CrossingIndex,
  length: number,
  constraints: Map<number, string>, // position -> required letter
  excludeWords?: Set<string>
): string[] {
  // Start with all normalized words of the right length
  let normalizedCandidates = index.byLength.get(length) || [];
  
  // Filter by each constraint
  for (const [position, letter] of constraints.entries()) {
    const posMap = index.byLetterPosition.get(letter);
    if (!posMap) {
      return []; // No words have this letter
    }
    
    const wordsWithLetter = posMap.get(position);
    if (!wordsWithLetter) {
      return []; // No words have this letter at this position
    }
    
    // Intersect with current candidates
    const candidateSet = new Set(normalizedCandidates);
    normalizedCandidates = wordsWithLetter.filter(w => 
      candidateSet.has(w) && w.length === length
    );
  }
  
  // Remove excluded words (normalize excluded words for comparison)
  if (excludeWords) {
    const normalizedExcluded = new Set(
      Array.from(excludeWords).map(w => w.replace(/\s+/g, '').toUpperCase())
    );
    normalizedCandidates = normalizedCandidates.filter(w => !normalizedExcluded.has(w));
  }
  
  // Convert normalized candidates back to original words (with spaces if applicable)
  return normalizedCandidates.map(normalized => 
    index.originalWords.get(normalized) || normalized
  );
}

// ============================================================================
// GRID BUILDER
// ============================================================================

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

// ============================================================================
// BACKTRACKING SOLVER
// ============================================================================

export interface SolverConfig {
  maxAttempts: number;
  shuffleWords: boolean;
  preferCommonWords: boolean;
  allowWordReuse?: boolean; // Allow words to be reused across slots
  wordScorer?: (word: string) => number;
}

const DEFAULT_SOLVER_CONFIG: SolverConfig = {
  maxAttempts: 10000,
  shuffleWords: true,
  preferCommonWords: true
};

/**
 * Shuffle an array (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Convert a template slot to cells
 */
function getSlotCells(slot: ClueSlot): Array<{ row: number; col: number }> {
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
  
  for (let i = 0; i < slot.length; i++) {
    cells.push({
      row: startRow + i * rowDelta,
      col: startCol + i * colDelta
    });
  }
  
  return cells;
}

/**
 * Main backtracking solver
 */
export function solveGrid(
  template: GridTemplate,
  wordIndex: CrossingIndex,
  config: SolverConfig = DEFAULT_SOLVER_CONFIG
): GridState | null {
  let attempts = 0;
  
  // Initialize grid state with clue cells marked
  const initialState = createEmptyGridState(template.rows, template.cols);
  for (const clueCell of template.clueCells) {
    initialState.clueCells.add(`${clueCell.row},${clueCell.col}`);
  }
  
  // IMPROVED: Use true MRV (Minimum Remaining Values) heuristic
  // Dynamically select the slot with fewest valid candidates at each step
  // This is the correct CSP approach - fail fast on most constrained slots
  
  // Track stuck states to detect infinite loops
  const stuckStates = new Map<string, number>(); // state signature -> attempt count
  
  /**
   * Select the next slot using MRV (Minimum Remaining Values) heuristic
   * Returns the slot with the fewest valid placeable candidates
   */
  function selectNextSlot(state: GridState, remainingSlots: ClueSlot[]): ClueSlot | null {
    let bestSlot: ClueSlot | null = null;
    let minCandidates = Infinity;
    
    for (const slot of remainingSlots) {
      const cells = getSlotCells(slot);
      const constraints = getCrossingConstraints(state, cells);
      
      // Find matching words
      const excludeWords = config.allowWordReuse === false 
        ? new Set(state.placedWords.values())
        : undefined;
      const candidates = findMatchingWords(wordIndex, slot.length, constraints, excludeWords);
      
      // CRITICAL: Pre-filter by placeability (key improvement from improved generator)
      const validCandidates = candidates.filter(w => canPlaceWord(state, w, cells));
      
      // Fail fast - if a slot has no valid candidates, return it immediately
      if (validCandidates.length === 0) {
        return slot; // This will cause backtrack to fail fast
      }
      
      // MRV: Select slot with fewest valid candidates
      if (validCandidates.length < minCandidates) {
        minCandidates = validCandidates.length;
        bestSlot = slot;
      }
    }
    
    return bestSlot;
  }
  
  function backtrack(state: GridState, remainingSlots: ClueSlot[], depth: number = 0): GridState | null {
    // Increment attempts to track exploration depth
    // This counts how many times we've entered the backtrack function
    attempts++;
    
    // Detect if we're stuck in a loop
    if (depth === 0 && remainingSlots.length > 0) {
      const stateSignature = `${remainingSlots.length}_${Array.from(state.placedWords.keys()).sort().join(',')}`;
      const previousAttempt = stuckStates.get(stateSignature) || 0;
      const attemptsSinceLast = attempts - previousAttempt;
      
      // If we've tried this exact state 5000+ times, we're stuck
      if (previousAttempt > 0 && attemptsSinceLast > 5000) {
        console.log(`  ⚠️  Detected stuck state with ${remainingSlots.length} slots remaining after ${attemptsSinceLast} attempts`);
        console.log(`     Placed words: ${Array.from(state.placedWords.values()).join(', ')}`);
        stuckStates.delete(stateSignature); // Reset to allow retry
        return null; // Exit this branch
      }
      
      if (previousAttempt === 0 || attemptsSinceLast > 1000) {
        stuckStates.set(stateSignature, attempts);
      }
    }
    
    // Progress logging every 10k attempts
    if (attempts % 10000 === 0 && depth === 0) {
      const placedWords = Array.from(state.placedWords.values());
      const totalSlots = template.slots.length;
      console.log(`  🔄 Solver progress: ${attempts}/${config.maxAttempts} attempts, ${placedWords.length}/${totalSlots} slots filled`);
    }
    
    if (attempts > config.maxAttempts) {
      if (attempts === config.maxAttempts + 1) {
        const placedWords = Array.from(state.placedWords.values());
        const totalSlots = template.slots.length;
        console.log(`  ⚠️  Max attempts (${config.maxAttempts}) reached. Progress: ${placedWords.length}/${totalSlots} slots filled`);
        if (placedWords.length > 0) {
          console.log(`     Placed words: ${placedWords.join(', ')}`);
        }
        // Show the current slot that's failing
        if (remainingSlots.length > 0) {
          const nextSlot = selectNextSlot(state, remainingSlots);
          if (nextSlot) {
            const cells = getSlotCells(nextSlot);
          const constraints = getCrossingConstraints(state, cells);
          const constraintInfo = constraints.size > 0 
            ? ` with ${constraints.size} constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
            : ' (no constraints)';
            console.log(`     Current slot: ${nextSlot.length} letters${constraintInfo}`);
          }
        }
      }
      return null;
    }
    
    // All slots filled successfully
    if (remainingSlots.length === 0) {
      if (depth === 0) {
        console.log(`  ✅ All slots filled successfully!`);
      }
      return state;
    }
    
    // IMPROVED: Use MRV to select the most constrained slot dynamically
    const slot = selectNextSlot(state, remainingSlots);
    if (!slot) {
      // No slot selected means all remaining slots have 0 valid candidates - fail fast
      return null;
    }
    
    const cells = getSlotCells(slot);
    const constraints = getCrossingConstraints(state, cells);
    
    // Find candidate words
    const excludeWords = config.allowWordReuse === false 
      ? new Set(state.placedWords.values())
      : undefined;
    
    let candidates = findMatchingWords(
      wordIndex,
      slot.length,
      constraints,
      excludeWords
    );
    
    // CRITICAL IMPROVEMENT: Pre-filter candidates by placeability
    // This avoids wasting time trying words that can't be placed
    const placeableCandidates = candidates.filter(w => canPlaceWord(state, w, cells));
    
    // IMPROVEMENT: Limit candidates to avoid trying too many (from improved generator)
    candidates = placeableCandidates.slice(0, 100);
    
    // Log first attempt for each slot (only at top level)
    if (depth === 0 && attempts === 1) {
      const constraintInfo = constraints.size > 0 
        ? ` with ${constraints.size} constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
        : ' (no constraints)';
      const totalSlots = template.slots.length;
      const remainingCount = remainingSlots.length;
      console.log(`  📍 Selected slot (${remainingCount} remaining): ${slot.length} letters${constraintInfo}, ${candidates.length} placeable candidates`);
      
      // If no candidates, show why
      if (candidates.length === 0) {
        console.log(`     ❌ No placeable candidates found for ${slot.length}-letter word${constraintInfo}`);
        // Show all words of this length
        const allWordsOfLength = Array.from(wordIndex.byLength.get(slot.length) || []);
        console.log(`     All ${slot.length}-letter words: ${allWordsOfLength.length} total`);
        if (constraints.size > 0) {
          console.log(`     Constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`);
        }
      }
    }
    
    if (candidates.length === 0) {
      // Debug: log why we have no candidates (always log when stuck)
      // This is the critical failure point - log it whenever it happens at top level
      if (depth === 0) {
        const constraintInfo = constraints.size > 0 
          ? ` with ${constraints.size} constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
          : ' (no constraints)';
        const wordsOfLength = wordIndex.byLength.get(slot.length) || [];
        const remainingCount = remainingSlots.length;
        const totalSlots = template.slots.length;
        console.log(`\n  🔍 Selected slot (${remainingCount}/${totalSlots} remaining) (${slot.length} letters${constraintInfo}): No candidates found`);
        console.log(`     Available words of length ${slot.length}: ${wordsOfLength.length} total`);
        if (wordsOfLength.length > 0 && wordsOfLength.length <= 20) {
          console.log(`     All words of this length: ${wordsOfLength.join(', ')}`);
        }
        if (constraints.size > 0) {
          // Show what words exist with each constraint
          for (const [pos, letter] of constraints.entries()) {
            const posMap = wordIndex.byLetterPosition.get(letter);
            const wordsWithLetter = posMap?.get(pos) || [];
            console.log(`     Words with '${letter}' at position ${pos}: ${wordsWithLetter.length}`);
            if (wordsWithLetter.length > 0 && wordsWithLetter.length <= 20) {
              console.log(`       Examples: ${wordsWithLetter.join(', ')}`);
            }
          }
          // Try to find words that match ALL constraints
          if (constraints.size > 1) {
            console.log(`     Looking for words matching ALL ${constraints.size} constraints...`);
            const matchingWords: string[] = [];
            const [firstPos, firstLetter] = Array.from(constraints.entries())[0];
            const firstPosMap = wordIndex.byLetterPosition.get(firstLetter);
            const candidatesFromFirst = firstPosMap?.get(firstPos) || [];
            for (const word of candidatesFromFirst) {
              if (word.length === slot.length) {
                let matchesAll = true;
                for (const [pos, letter] of constraints.entries()) {
                  if (word[pos] !== letter) {
                    matchesAll = false;
                    break;
                  }
                }
                if (matchesAll) {
                  matchingWords.push(word);
                }
              }
            }
            console.log(`     Words matching ALL constraints: ${matchingWords.length}`);
            if (matchingWords.length > 0 && matchingWords.length <= 20) {
              console.log(`       ${matchingWords.join(', ')}`);
            }
          }
        }
        // Show what words are already placed
        const placedWords = Array.from(state.placedWords.values());
        if (placedWords.length > 0) {
          console.log(`     Already placed words: ${placedWords.join(', ')}`);
        }
        // Show the current grid state
        console.log(`     Current grid state (showing relevant area):`);
        const cells = getSlotCells(slot);
        const minRow = Math.min(...cells.map(c => c.row));
        const maxRow = Math.max(...cells.map(c => c.row));
        const minCol = Math.min(...cells.map(c => c.col));
        const maxCol = Math.max(...cells.map(c => c.col));
        for (let r = minRow; r <= maxRow; r++) {
          const row: string[] = [];
          for (let c = minCol; c <= maxCol; c++) {
            const letter = getLetterAt(state, r, c);
            row.push(letter || '.');
          }
          console.log(`       Row ${r}: ${row.join(' ')}`);
        }
      }
      return null; // Dead end
    }
    
    // Shuffle for variety
    if (config.shuffleWords) {
      candidates = shuffleArray(candidates);
    }
    
    // Early exit if no candidates at all (already filtered by placeability)
    if (candidates.length === 0) {
      if (depth === 0) {
        const constraintInfo = constraints.size > 0 
          ? ` with ${constraints.size} constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
          : ' (no constraints)';
        const remainingCount = remainingSlots.length;
        console.log(`  ❌ Selected slot (${remainingCount} remaining): ${slot.length} letters${constraintInfo}: No placeable candidates - impossible state`);
      }
      return null;
    }
    
    // Try each candidate (already pre-filtered by placeability and limited to 100)
    for (let i = 0; i < candidates.length; i++) {
      const word = candidates[i];
      
      // Check if we've exceeded max attempts before trying this word
      if (attempts > config.maxAttempts) {
        return null;
      }
      
      // Debug: Log why first few words fail (only on first few attempts)
      if (i < 3 && depth === 0 && attempts <= 5) {
        const canPlace = canPlaceWord(state, word, cells);
        if (!canPlace) {
          // Check why it failed
          for (let j = 0; j < word.length; j++) {
            const { row, col } = cells[j];
            const boundsOk = row >= 0 && row < state.rows && col >= 0 && col < state.cols;
            const isClueCell = state.clueCells.has(`${row},${col}`);
            const existing = boundsOk ? state.cells[row][col] : null;
            const conflicts = existing !== null && existing !== word[j];
            if (!boundsOk) {
              console.log(`     ❌ Word "${word}" fails: cell ${j} (${row},${col}) out of bounds (grid: ${state.rows}x${state.cols})`);
              break;
            } else if (isClueCell) {
              console.log(`     ❌ Word "${word}" fails: cell ${j} (${row},${col}) is a clue cell`);
              break;
            } else if (conflicts) {
              console.log(`     ❌ Word "${word}" fails: cell ${j} (${row},${col}) has '${existing}' but needs '${word[j]}'`);
              break;
            }
          }
        }
      }
      
      if (!canPlaceWord(state, word, cells)) {
        continue;
      }
      
      const newState = placeWord(state, slot.id, word, cells);
      const newRemaining = remainingSlots.filter(s => s.id !== slot.id);
      const result = backtrack(newState, newRemaining, depth + 1);
      
      if (result !== null) {
        if (depth === 0) {
          const remainingCount = newRemaining.length;
          const totalSlots = template.slots.length;
          console.log(`  ✅ Placed "${word}" (${remainingCount}/${totalSlots} remaining)`);
        }
        return result;
      }
      
      // If we're near the failure point, log what's happening
      if (depth === 0 && attempts >= 950 && attempts <= 960 && i < 3) {
        const placedWords = Array.from(state.placedWords.values());
        const remainingCount = newRemaining.length;
        const totalSlots = template.slots.length;
        console.log(`  🔍 Attempt ${attempts}: Trying "${word}" (${i + 1}/${candidates.length})`);
        console.log(`     Placed so far: ${placedWords.length > 0 ? placedWords.join(', ') : 'none'}`);
        console.log(`     Remaining slots: ${remainingCount}/${totalSlots}`);
        
        // Check what the next slot would be (using MRV)
        if (newRemaining.length > 0) {
          const nextSlot = selectNextSlot(newState, newRemaining);
          if (nextSlot) {
            const nextCells = getSlotCells(nextSlot);
            const nextConstraints = getCrossingConstraints(newState, nextCells);
            const nextConstraintInfo = nextConstraints.size > 0 
              ? ` with ${nextConstraints.size} constraints: ${Array.from(nextConstraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
              : ' (no constraints)';
            const nextCandidates = findMatchingWords(wordIndex, nextSlot.length, nextConstraints, excludeWords);
            const nextPlaceable = nextCandidates.filter(w => canPlaceWord(newState, w, nextCells));
            console.log(`     Next slot would be: ${nextSlot.length} letters${nextConstraintInfo}: ${nextPlaceable.length} placeable candidates`);
            if (nextPlaceable.length === 0) {
              console.log(`     ❌ Next slot has NO placeable candidates - dead end!`);
            }
          }
        }
      }
    }
    
    return null; // No valid word found
  }
  
  console.log(`  🧩 Solving template "${template.name}" with ${template.slots.length} slots...`);
  
  // Special optimization: if template has NO crossings, solve it greedily
  // Since slots are independent, we can just pick the first valid word for each
  const hasAnyCrossings = template.slots.some(slot => slot.crossings.length > 0);
  if (!hasAnyCrossings) {
    console.log(`  ⚡ Template has no crossings - using fast greedy solver`);
    let currentState = initialState;
    for (let i = 0; i < template.slots.length; i++) {
      const slot = template.slots[i];
      const cells = getSlotCells(slot);
      const candidates = findMatchingWords(wordIndex, slot.length, new Map(), undefined);
      if (candidates.length === 0) {
        console.log(`  ❌ No words available for ${slot.length}-letter slot`);
        return null;
      }
      // Just pick the first candidate
      const word = candidates[0];
      if (!canPlaceWord(currentState, word, cells)) {
        console.log(`  ❌ Cannot place word "${word}" in slot ${i + 1}`);
        return null;
      }
      currentState = placeWord(currentState, slot.id, word, cells);
      console.log(`  ✅ Slot ${i + 1}/${template.slots.length}: Placed "${word}"`);
    }
    console.log(`  ✅ Solved template in ${attempts} attempts (greedy mode)`);
    return currentState;
  }
  
  const startTime = Date.now();
  const result = backtrack(initialState, [...template.slots]);
  const elapsed = Date.now() - startTime;
  if (!result) {
    console.log(`  ❌ Failed to solve template after ${attempts} attempts (${elapsed}ms)`);
    // Show which slots were successfully filled (result is null, so we can't show placed words)
  } else {
    console.log(`  ✅ Solved template in ${attempts} attempts (${elapsed}ms)`);
  }
  return result;
}

// ============================================================================
// TEMPLATE CREATION HELPERS
// ============================================================================

/**
 * Create a template from a working puzzle (reverse engineering)
 */
export function createTemplateFromPuzzle(puzzle: Puzzle): GridTemplate {
  const slots: ClueSlot[] = [];
  const clueCells: Array<{ row: number; col: number; direction: Direction }> = [];
  
  // Build slot map for crossing detection
  const cellToSlot = new Map<string, { slotId: string; position: number }>();
  
  for (const clue of puzzle.clues) {
    const slotId = `slot_${clue.number}`;
    const cells = getAnswerCells(clue);
    
    // Record clue cell
    clueCells.push({
      row: clue.startRow,
      col: clue.startCol,
      direction: clue.direction
    });
    
    // Map cells to this slot
    cells.forEach((cell, pos) => {
      const key = `${cell.row},${cell.col}`;
      if (cellToSlot.has(key)) {
        // This cell is a crossing
      }
      cellToSlot.set(key, { slotId, position: pos });
    });
    
    slots.push({
      id: slotId,
      direction: clue.direction,
      startRow: clue.startRow,
      startCol: clue.startCol,
      length: clue.answer.length,
      crossings: [] // Will fill in next pass
    });
  }
  
  // Second pass: detect crossings
  for (const clue of puzzle.clues) {
    const slotId = `slot_${clue.number}`;
    const slot = slots.find(s => s.id === slotId)!;
    const cells = getAnswerCells(clue);
    
    for (let pos = 0; pos < cells.length; pos++) {
      const cell = cells[pos];
      const key = `${cell.row},${cell.col}`;
      
      // Check all other slots for crossing at this cell
      for (const otherClue of puzzle.clues) {
        if (otherClue.number === clue.number) continue;
        
        const otherSlotId = `slot_${otherClue.number}`;
        const otherCells = getAnswerCells(otherClue);
        
        for (let otherPos = 0; otherPos < otherCells.length; otherPos++) {
          const otherCell = otherCells[otherPos];
          if (otherCell.row === cell.row && otherCell.col === cell.col) {
            slot.crossings.push({
              slotId: otherSlotId,
              thisPosition: pos,
              otherPosition: otherPos
            });
          }
        }
      }
    }
  }
  
  return {
    id: `template_${puzzle.title.toLowerCase().replace(/\s+/g, '_')}`,
    name: puzzle.title,
    rows: puzzle.grid.rows,
    cols: puzzle.grid.cols,
    slots,
    clueCells,
    difficulty: puzzle.difficulty,
    categories: [puzzle.category],
    metadata: {
      verified: true,
      successRate: 1.0
    }
  };
}

// ============================================================================
// PUZZLE GENERATION FROM FILLED GRID
// ============================================================================

export interface ClueDatabase {
  getClue(word: string, difficulty: Difficulty): string;
  getAllClues?(word: string, difficulty: Difficulty): string[]; // Optional: get all available clues
}

/**
 * Generate a complete puzzle from a solved grid state
 */
export function generatePuzzleFromGrid(
  template: GridTemplate,
  gridState: GridState,
  clueDb: ClueDatabase,
  config: {
    title: string;
    difficulty: Difficulty;
    category: string;
    estimatedTime: number;
    coinReward: number;
  }
): Puzzle {
  const clues: Clue[] = [];
  const usedClues = new Set<string>(); // Track used clue texts to prevent duplicates
  
  let clueNumber = 1;
  for (const slot of template.slots) {
    const word = gridState.placedWords.get(slot.id);
    if (!word) {
      throw new Error(`No word placed for slot ${slot.id}`);
    }
    
    // Get clue, ensuring it's not a duplicate
    let clueText: string;
    
    // Try to get all available clues if the database supports it
    if (clueDb.getAllClues) {
      const allClues = clueDb.getAllClues(word, config.difficulty);
      // Find the first clue that hasn't been used
      const unusedClue = allClues.find(clue => !usedClues.has(clue));
      if (unusedClue) {
        clueText = unusedClue;
      } else {
        // All clues for this word are used, use the first one with a suffix
        clueText = `${allClues[0]} (${word})`;
      }
    } else {
      // Fallback: try random clues up to 10 times
      clueText = clueDb.getClue(word, config.difficulty);
      let attempts = 0;
      const maxClueAttempts = 10;
      
      while (usedClues.has(clueText) && attempts < maxClueAttempts) {
        attempts++;
        clueText = clueDb.getClue(word, config.difficulty);
      }
      
      // If we still have a duplicate after max attempts, use a fallback
      if (usedClues.has(clueText)) {
        clueText = `${clueText} (${word})`; // Add word to make it unique
      }
    }
    
    usedClues.add(clueText);
    
    // Handle multi-word answers (e.g., "STAR WARS" -> [4, 4])
    const words = word.split(' ');
    const enumeration = words.map(w => w.length);
    
    clues.push({
      number: clueNumber++,
      direction: slot.direction,
      clue: clueText,
      answer: word,
      enumeration: enumeration,
      startRow: slot.startRow,
      startCol: slot.startCol
    });
  }
  
  // Validate minimum clue count based on grid size
  // Updated minimums to match puzzlesGenerator.ts - more lenient with 6M clues
  const minClues = template.rows === 11 && template.cols === 11 ? 18 : 
                   template.rows === 14 && template.cols === 14 ? 30 :
                   template.rows === 15 && template.cols === 15 ? 50 :
                   template.rows === 16 && template.cols === 16 ? 45 : 20;
  
  if (clues.length < minClues) {
    // Instead of throwing, return null to allow retry
    // This prevents crashes and allows the generator to try again
    console.error(`❌ Puzzle has only ${clues.length} clues, but minimum is ${minClues} for ${template.rows}x${template.cols} grid`);
    throw new Error(`Puzzle has only ${clues.length} clues, but minimum is ${minClues} for ${template.rows}x${template.cols} grid`);
  }
  
  return {
    title: config.title,
    difficulty: config.difficulty,
    category: config.category,
    grid: { rows: template.rows, cols: template.cols },
    clues,
    estimatedTime: config.estimatedTime,
    coinReward: config.coinReward,
    metadata: {
      templateId: template.id,
      generationMethod: 'algorithmic'
    }
  };
}

// ============================================================================
// PROGRAMMATIC TEMPLATE GENERATION
// ============================================================================

/**
 * Generate a template programmatically for larger, more complex puzzles
 * Creates a grid with strategic slot placement and crossings
 */
export function generateTemplate(
  size: 'small' | 'medium' | 'large' | 'xlarge',
  difficulty: Difficulty = Difficulty.EASY
): GridTemplate {
  // MAXIMUM DENSITY: Target 98%+ coverage (only 5 empty cells for xlarge)
  // Need many slots, but keep crossings reasonable for solvability
  // Lower max crossings = more solvable, but we need MORE slots to compensate
  const sizeConfig = {
    small: { rows: 14, cols: 14, minSlots: 50, maxSlots: 100, maxCrossingsPerSlot: 10, density: 0.99 },
    medium: { rows: 11, cols: 11, minSlots: 25, maxSlots: 120, maxCrossingsPerSlot: 10, density: 0.99 },
    large: { rows: 15, cols: 15, minSlots: 80, maxSlots: 150, maxCrossingsPerSlot: 12, density: 0.99 },
    xlarge: { rows: 16, cols: 16, minSlots: 90, maxSlots: 180, maxCrossingsPerSlot: 12, density: 0.99 }
  };
  
  const config = sizeConfig[size];
  const slots: ClueSlot[] = [];
  const clueCells: Array<{ row: number; col: number; direction: Direction }> = [];
  const occupiedCells = new Set<string>(); // Track which cells have clues
  const answerCells = new Map<string, { slotId: string; position: number }>(); // Track answer cells for crossings
  
  // Generate slots with strategic placement for dense puzzles
  // With 6M clues, aim for maximum slots to achieve ultra-density
  let slotNumber = 1;
  // Aim for 80-90% of max slots to ensure we get enough for dense puzzles
  const targetRange = config.maxSlots - config.minSlots;
  const targetSlots = Math.floor(config.minSlots + (targetRange * 0.8) + Math.random() * (targetRange * 0.2));
  
  // Use all 6 directions evenly for variety
  // Track which directions have been used to ensure all are used
  const allDirections: Direction[] = ['across', 'down', 'right-down', 'left-down', 'down-across', 'up-across'];
  const directionUsage = new Map<Direction, number>();
  allDirections.forEach(dir => directionUsage.set(dir, 0));
  
  // Create a balanced distribution - each direction appears multiple times
  const directions: Direction[] = [];
  for (let i = 0; i < Math.ceil(targetSlots / allDirections.length) + 2; i++) {
    directions.push(...allDirections);
  }
  // Shuffle for randomness
  for (let i = directions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [directions[i], directions[j]] = [directions[j], directions[i]];
  }
  
  for (let i = 0; i < targetSlots && slotNumber <= targetSlots; i++) {
    // Try to place a slot
    let placed = false;
    let attempts = 0;
    // MAXIMUM COMPUTE POWER: Use all available attempts for perfect placement
    // Significantly increased attempts to ensure we can place all slots
    // With 6M clues, use many more attempts to place all slots
    const maxPlacementAttempts = size === 'xlarge' ? 15000 : size === 'large' ? 12000 : size === 'medium' ? 8000 : 5000;
    
    while (!placed && attempts < maxPlacementAttempts) {
      attempts++;
      
      // Smart direction selection: prioritize unused directions, then balance
      let direction: Direction;
      if (i < allDirections.length) {
        // First 6 slots: use each direction once to ensure all are used
        direction = allDirections[i];
      } else {
        // After that, prefer less-used directions but allow all
        const sortedDirections = [...allDirections].sort((a, b) => 
          (directionUsage.get(a) || 0) - (directionUsage.get(b) || 0)
        );
        // 70% chance to pick from least-used, 30% random
        if (Math.random() < 0.7 && sortedDirections.length > 0) {
          const leastUsed = sortedDirections[0];
          const leastUsedCount = directionUsage.get(leastUsed) || 0;
          const candidates = sortedDirections.filter(d => 
            (directionUsage.get(d) || 0) <= leastUsedCount + 1
          );
          direction = candidates[Math.floor(Math.random() * candidates.length)];
        } else {
          direction = directions[Math.floor(Math.random() * directions.length)];
        }
      }
      
      // AGGRESSIVE DENSITY: Smart placement to maximize crossings and fill gaps
      let startRow: number;
      let startCol: number;
      
      // SWEDISH ARROW STRATEGY: Balance crossings with coverage
      // After initial slots, prioritize both crossings AND filling empty areas
      if (i > targetSlots * 0.10 && answerCells.size > 0) {
        // Find empty cells that could be filled
        const emptyCellsList: Array<{ row: number; col: number }> = [];
        for (let r = 0; r < config.rows; r++) {
          for (let c = 0; c < config.cols; c++) {
            const cellKey = `${r},${c}`;
            if (!occupiedCells.has(cellKey) && !answerCells.has(cellKey)) {
              emptyCellsList.push({ row: r, col: c });
            }
          }
        }
        
        // 70% chance to place near existing answer cells for crossings
        // 30% chance to place near empty cells to fill gaps
        if (Math.random() < 0.70 && answerCells.size > 0) {
          const existingCells = Array.from(answerCells.keys());
          const randomCellKey = existingCells[Math.floor(Math.random() * existingCells.length)];
          const [cellRow, cellCol] = randomCellKey.split(',').map(Number);
          
          // Place clue cell strategically near this answer cell
          // Use very tight range to create maximum crossings (0 to 1 offset)
          const offsetRow = Math.floor(Math.random() * 2); // 0 to 1 (very tight for maximum crossings)
          const offsetCol = Math.floor(Math.random() * 2);
          startRow = Math.max(0, Math.min(config.rows - 1, cellRow + offsetRow));
          startCol = Math.max(0, Math.min(config.cols - 1, cellCol + offsetCol));
        } else if (emptyCellsList.length > 0) {
          // Place near empty cells to fill gaps
          const targetEmpty = emptyCellsList[Math.floor(Math.random() * emptyCellsList.length)];
          // Place clue cell near empty area (within 1-2 cells)
          const offsetRow = Math.floor(Math.random() * 3) - 1; // -1 to 1
          const offsetCol = Math.floor(Math.random() * 3) - 1;
          startRow = Math.max(0, Math.min(config.rows - 1, targetEmpty.row + offsetRow));
          startCol = Math.max(0, Math.min(config.cols - 1, targetEmpty.col + offsetCol));
        } else {
          // Fallback: random placement
          startRow = Math.floor(Math.random() * config.rows);
          startCol = Math.floor(Math.random() * config.cols);
        }
      } else {
        // First 10%: Random placement to establish initial grid structure
        startRow = Math.floor(Math.random() * config.rows);
        startCol = Math.floor(Math.random() * config.cols);
      }
      
      // Adjust for direction constraints
      if (direction === 'left-down' && startCol < 3) startCol = Math.max(3, startCol);
      if (direction === 'up-across' && startRow < 2) startRow = Math.max(2, startRow);
      if (direction === 'right-down' && startCol >= config.cols - 1) startCol = Math.max(0, config.cols - 2);
      if (direction === 'down-across' && startRow >= config.rows - 1) startRow = Math.max(0, config.rows - 2);
      
      // IMPROVED: Better word length selection - use 3-5 letters for better solvability
      // The improved generator uses 3-5 letters which matches word lists better
      const maxLength = size === 'small' ? 5 : size === 'medium' ? 5 : size === 'large' ? 6 : 7;
      const minLength = 3; // Start from 3 letters (improved generator approach)
      
      // IMPROVED: Optimal length selection - try different lengths and pick the one with most crossings
      // This is smarter than random selection
      let bestLength = 0;
      let bestCrossings = -1;
      let bestAnswerCells: Array<{ row: number; col: number }> = [];
      
      for (let testLength = minLength; testLength <= maxLength; testLength++) {
        // Create a temporary slot to calculate answer cells
        const tempSlot: ClueSlot = {
          id: 'temp',
          direction,
          startRow,
          startCol,
          length: testLength,
          crossings: []
        };
        
        const testAnswerCells = getSlotCells(tempSlot);
        
        // Check if answer fits in bounds
        const lastCell = testAnswerCells[testAnswerCells.length - 1];
        const endRow = lastCell.row;
        const endCol = lastCell.col;
        
        if (endRow < 0 || endRow >= config.rows || endCol < 0 || endCol >= config.cols) {
          continue; // This length doesn't fit
        }
        
        // Check if clue cell is available
        const testClueKey = `${startRow},${startCol}`;
        if (occupiedCells.has(testClueKey)) {
          continue; // Clue cell already taken
        }
        
        // Check for conflicts and count perpendicular crossings
        let hasConflict = false;
        let crossingCount = 0;
        const testCrossingSlots = new Set<string>();
        const testOrientation = getAnswerOrientation(direction);
        
        // Check clue cell doesn't overlap with answer cells
        if (answerCells.has(testClueKey)) {
          hasConflict = true;
        }
        
        for (const cell of testAnswerCells) {
          const cellKey = `${cell.row},${cell.col}`;
          
          // Can't place answer in a clue cell
          if (occupiedCells.has(cellKey)) {
            hasConflict = true;
            break;
          }
          
          // Count perpendicular crossings only
          if (answerCells.has(cellKey)) {
            const existingSlotInfo = answerCells.get(cellKey);
            if (existingSlotInfo) {
              const existingSlot = slots.find(s => s.id === existingSlotInfo.slotId);
              if (existingSlot) {
                const existingOrientation = getAnswerOrientation(existingSlot.direction);
                if (existingOrientation !== testOrientation) {
                  testCrossingSlots.add(existingSlotInfo.slotId);
                } else {
                  hasConflict = true; // Parallel overlap = conflict
                  break;
                }
              }
            }
          }
        }
        
        if (!hasConflict && testCrossingSlots.size >= bestCrossings) {
          bestCrossings = testCrossingSlots.size;
          bestLength = testLength;
          bestAnswerCells = testAnswerCells;
        }
      }
      
      // If no valid length found, skip this position
      if (bestLength < minLength) {
        continue; // Try again with different position
      }
      
      const wordLength = bestLength;
      const answerCellsForSlot = bestAnswerCells;
      const clueKey = `${startRow},${startCol}`;
      
      // Recalculate crossing count for the selected length (already validated in optimal selection)
      const crossingSlots = new Set<string>();
      const currentOrientation = getAnswerOrientation(direction);
      
      for (const cell of answerCellsForSlot) {
        const cellKey = `${cell.row},${cell.col}`;
        if (answerCells.has(cellKey)) {
          const existingSlotInfo = answerCells.get(cellKey);
          if (existingSlotInfo) {
            const existingSlot = slots.find(s => s.id === existingSlotInfo.slotId);
            if (existingSlot) {
              const existingOrientation = getAnswerOrientation(existingSlot.direction);
              // Only count perpendicular crossings
              if (existingOrientation !== currentOrientation) {
                crossingSlots.add(existingSlotInfo.slotId);
              }
            }
          }
        }
      }
      
      const crossingCount = crossingSlots.size; // Number of different slots we cross with (perpendicular only)
      const canPlace = true; // Already validated in optimal length selection
      
      // PROGRESSIVE CROSSING LIMITS: With 6M clues, be much more lenient
      // We need many slots for ultra-density - allow more crossings during placement
      const progressRatio = i / targetSlots;
      let maxAllowedCrossings: number;
      
      // Much more lenient limits to ensure we place enough slots
      if (progressRatio < 0.20) {
        maxAllowedCrossings = 8; // First 20%: max 8 crossings
      } else if (progressRatio < 0.50) {
        maxAllowedCrossings = 10; // Next 30%: max 10 crossings
      } else if (progressRatio < 0.80) {
        maxAllowedCrossings = 12; // Next 30%: max 12 crossings
      } else {
        maxAllowedCrossings = config.maxCrossingsPerSlot; // Last 20%: up to config max (12)
      }
      
      // CRITICAL: Strictly enforce crossing limits during placement
      // This prevents placing slots that will be filtered out later
      if (crossingCount > maxAllowedCrossings) {
        continue; // Too many crossings for this stage, try a different position
      }
      
      // Don't reject at-limit crossings - we need all the slots we can get for density
      // The filtering will handle any that are truly too constrained
      
      // With 6M clues: Be less strict about requiring crossings
      // Focus on placing as many slots as possible - crossings will come naturally
      if (crossingCount === 0 && i > targetSlots * 0.30) {
        // After 30% of slots, prefer crossings but don't be too strict
        // With huge clue database, we can fill gaps later
        const progressRatio = i / targetSlots;
        const slotsBehind = (i + 1) < (targetSlots * progressRatio * 0.7);
        const skipChance = slotsBehind ? 0.60 : 0.75; // Much less strict - prioritize slot count
        if (Math.random() < skipChance) {
          continue; // Skip some slots without crossings
        }
      }
      
      // Also prefer slots with MORE crossings (within limits) - give them priority
      if (crossingCount >= 2 && crossingCount < maxAllowedCrossings && i > targetSlots * 0.15) {
        // If we have good crossings, accept this slot more readily
        // This is handled by the skip logic above, but we can be explicit
      }
      
      // Bonus: Prefer slots with MORE crossings (within limits)
      if (crossingCount > 0 && crossingCount < maxAllowedCrossings && i > targetSlots * 0.25) {
        // If we have crossings but room for more, give this slot priority
        // This is handled implicitly by the skip logic above, but we can be more explicit
      }
      
      // Also prefer slots with MORE crossings (within limits)
      if (crossingCount > 0 && crossingCount < maxAllowedCrossings && i > targetSlots * 0.3) {
        // If we have some crossings but room for more, prefer this slot
        // (This is handled by the crossing count check above, but we can be more aggressive)
      }
      
      if (!canPlace) {
        continue;
      }
      
      // Place the slot
      const slotId = `slot_${slotNumber}`;
      const slot: ClueSlot = {
        id: slotId,
        direction,
        startRow,
        startCol,
        length: wordLength,
        crossings: [] // Will calculate after all slots are placed
      };
      
      slots.push(slot);
      clueCells.push({ row: startRow, col: startCol, direction });
      occupiedCells.add(clueKey);
      
      // Track direction usage
      directionUsage.set(direction, (directionUsage.get(direction) || 0) + 1);
      
      // Mark answer cells using the calculated cells
      for (let j = 0; j < answerCellsForSlot.length; j++) {
        const cell = answerCellsForSlot[j];
        const cellKey = `${cell.row},${cell.col}`;
        answerCells.set(cellKey, { slotId, position: j });
      }
      
      placed = true;
      slotNumber++;
    }
  }
  
  // Calculate crossings between slots
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const slotCells = getSlotCells(slot);
    
    for (let j = i + 1; j < slots.length; j++) {
      const otherSlot = slots[j];
      const otherCells = getSlotCells(otherSlot);
      
      // Find crossing points
      for (let pos = 0; pos < slotCells.length; pos++) {
        const cell = slotCells[pos];
        const cellKey = `${cell.row},${cell.col}`;
        
        for (let otherPos = 0; otherPos < otherCells.length; otherPos++) {
          const otherCell = otherCells[otherPos];
          if (cell.row === otherCell.row && cell.col === otherCell.col) {
            // Found a crossing!
            slot.crossings.push({
              slotId: otherSlot.id,
              thisPosition: pos,
              otherPosition: otherPos
            });
            otherSlot.crossings.push({
              slotId: slot.id,
              thisPosition: otherPos,
              otherPosition: pos
            });
          }
        }
      }
    }
  }
  
  // CRITICAL: Sort slots by crossing count (fewest first)
  // The solver will solve slots with most crossings first (MRV heuristic),
  // but we want the FIRST slots to have FEW crossings so they're solvable
  // So we'll sort by crossing count ASCENDING, then filter
  slots.sort((a, b) => a.crossings.length - b.crossings.length);
  
  // FILTERING: Keep slots with reasonable crossing counts
  // Be lenient initially to keep more slots, filter more aggressively later
  const filteredSlots: typeof slots = [];
  
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const crossings = slot.crossings.length;
    
    // SOLVABILITY: Keep slots with up to 15 crossings initially
    // We'll filter more aggressively in the second pass, but keep more initially
    // to ensure we have enough slots to meet the minimum
    const hardCap = 15; // Allow up to 15 crossings initially (increased from 12)
    if (crossings <= hardCap) {
      filteredSlots.push(slot);
    } else {
      console.log(`  ⚠️  Filtered out slot ${slot.id}: ${crossings} crossings (too many)`);
    }
  }
  
  console.log(`  📊 After first filtering: ${slots.length} -> ${filteredSlots.length} slots`);
  
  // Log direction usage for debugging
  const directionCounts = Array.from(directionUsage.entries())
    .map(([dir, count]) => `${dir}:${count}`)
    .join(', ');
  console.log(`  📊 Direction usage: ${directionCounts}`);
  
  // CRITICAL: Validate that no answer cells overlap with clue cells
  // Build a set of all clue cell positions
  const allClueCellPositions = new Set<string>();
  for (const slot of filteredSlots) {
    allClueCellPositions.add(`${slot.startRow},${slot.startCol}`);
  }
  
  // Filter out any slots whose answer cells overlap with clue cells
  const validatedSlots: typeof filteredSlots = [];
  for (const slot of filteredSlots) {
    const answerCells = getSlotCells(slot);
    let hasOverlap = false;
    for (const cell of answerCells) {
      const cellKey = `${cell.row},${cell.col}`;
      if (allClueCellPositions.has(cellKey)) {
        // This answer cell overlaps with a clue cell - invalid!
        hasOverlap = true;
        break;
      }
    }
    if (!hasOverlap) {
      validatedSlots.push(slot);
    } else {
      console.log(`  ⚠️  Filtered out slot ${slot.id}: answer cells overlap with clue cells`);
    }
  }
  
  // CRITICAL: Recalculate crossings after filtering
  // When we remove slots, other slots' crossing counts decrease
  // Clear all crossings first
  for (const slot of validatedSlots) {
    slot.crossings = [];
  }
  
  // Recalculate crossings only between validated slots
  for (let i = 0; i < validatedSlots.length; i++) {
    const slot = validatedSlots[i];
    const slotCells = getSlotCells(slot);
    
    for (let j = i + 1; j < validatedSlots.length; j++) {
      const otherSlot = validatedSlots[j];
      const otherCells = getSlotCells(otherSlot);
      
      // Find crossing points
      for (let pos = 0; pos < slotCells.length; pos++) {
        const cell = slotCells[pos];
        const cellKey = `${cell.row},${cell.col}`;
        
        for (let otherPos = 0; otherPos < otherCells.length; otherPos++) {
          const otherCell = otherCells[otherPos];
          if (cell.row === otherCell.row && cell.col === otherCell.col) {
            // Found a crossing!
            slot.crossings.push({
              slotId: otherSlot.id,
              thisPosition: pos,
              otherPosition: otherPos
            });
            otherSlot.crossings.push({
              slotId: slot.id,
              thisPosition: otherPos,
              otherPosition: pos
            });
            break; // Only one crossing per cell pair
          }
        }
      }
    }
  }
  
  // CRITICAL: Validate that answer cells only overlap at crossing points
  // If two slots' answer cells overlap but it's not a crossing, that's invalid
  const slotsWithInvalidOverlaps: typeof validatedSlots = [];
  for (let i = 0; i < validatedSlots.length; i++) {
    const slot = validatedSlots[i];
    const slotCells = getSlotCells(slot);
    const slotCellSet = new Set(slotCells.map(c => `${c.row},${c.col}`));
    
    // Check all other slots
    for (let j = 0; j < validatedSlots.length; j++) {
      if (i === j) continue;
      const otherSlot = validatedSlots[j];
      const otherCells = getSlotCells(otherSlot);
      
      // Check if there's an overlap
      for (const cell of otherCells) {
        const cellKey = `${cell.row},${cell.col}`;
        if (slotCellSet.has(cellKey)) {
          // Found an overlap - verify it's a proper crossing
          const isCrossing = slot.crossings.some(c => c.slotId === otherSlot.id);
          if (!isCrossing) {
            // Invalid overlap - answer cells share a cell but it's not a crossing!
            if (!slotsWithInvalidOverlaps.includes(slot)) {
              slotsWithInvalidOverlaps.push(slot);
            }
            if (!slotsWithInvalidOverlaps.includes(otherSlot)) {
              slotsWithInvalidOverlaps.push(otherSlot);
            }
            console.log(`  ⚠️  Invalid overlap: ${slot.id} and ${otherSlot.id} share answer cell (${cell.row},${cell.col}) but it's not a crossing`);
          }
        }
      }
    }
  }
  
  // Remove slots with invalid overlaps
  if (slotsWithInvalidOverlaps.length > 0) {
    console.log(`  ⚠️  Removing ${slotsWithInvalidOverlaps.length} slots with invalid answer cell overlaps`);
    const validSlots = validatedSlots.filter(s => !slotsWithInvalidOverlaps.includes(s));
    // Clear and recalculate crossings for remaining slots
    for (const slot of validSlots) {
      slot.crossings = [];
    }
    // Recalculate crossings for valid slots only
    for (let i = 0; i < validSlots.length; i++) {
      const slot = validSlots[i];
      const slotCells = getSlotCells(slot);
      for (let j = i + 1; j < validSlots.length; j++) {
        const otherSlot = validSlots[j];
        const otherCells = getSlotCells(otherSlot);
        for (let pos = 0; pos < slotCells.length; pos++) {
          const cell = slotCells[pos];
          for (let otherPos = 0; otherPos < otherCells.length; otherPos++) {
            const otherCell = otherCells[otherPos];
            if (cell.row === otherCell.row && cell.col === otherCell.col) {
              slot.crossings.push({
                slotId: otherSlot.id,
                thisPosition: pos,
                otherPosition: otherPos
              });
              otherSlot.crossings.push({
                slotId: slot.id,
                thisPosition: otherPos,
                otherPosition: pos
              });
              break;
            }
          }
        }
      }
    }
    // Replace validatedSlots with validSlots
    validatedSlots.length = 0;
    validatedSlots.push(...validSlots);
  }
  
  // Now filter again with recalculated crossings - be more selective for solvability
  const finalFilteredSlots: typeof validatedSlots = [];
  for (let i = 0; i < validatedSlots.length; i++) {
    const slot = validatedSlots[i];
    const crossings = slot.crossings.length;
    
    // With 6M clues: Keep slots with up to 12 crossings for ultra-dense puzzles
    // Progressive limits: earlier slots can have fewer crossings
    // Much more lenient to keep as many slots as possible
    const progressRatio = i / validatedSlots.length;
    let maxAllowed: number;
    if (progressRatio < 0.40) {
      maxAllowed = 10; // First 40%: max 10 crossings
    } else if (progressRatio < 0.80) {
      maxAllowed = 11; // Next 40%: max 11 crossings
    } else {
      maxAllowed = 12; // Last 20%: max 12 crossings (config max)
    }
    
    if (crossings <= maxAllowed) {
      finalFilteredSlots.push(slot);
    } else {
      // Log when we filter out slots for debugging
      if (i < 5 || i % 10 === 0) {
        console.log(`  ⚠️  Filtered out slot ${slot.id} (recalc): ${crossings} crossings (max: ${maxAllowed})`);
      }
    }
  }
  
  console.log(`  📊 After second filtering: ${validatedSlots.length} -> ${finalFilteredSlots.length} slots`);
  
  // If we filtered out too many, be more lenient to maintain density
  console.log(`  📊 Initial placement: ${slots.length} slots placed`);
  if (finalFilteredSlots.length < config.minSlots * 0.6) {
    console.warn(`⚠️  Warning: Filtered out too many slots (${slots.length} -> ${finalFilteredSlots.length}). Only ${finalFilteredSlots.length} slots remain, need at least ${config.minSlots}.`);
    // If we have too few slots, be MUCH less aggressive with filtering
    if (finalFilteredSlots.length < config.minSlots * 0.6) {
      console.warn(`⚠️  Critical: Too few slots! Relaxing filtering constraints...`);
      // Re-add filtered slots to meet minimum - be VERY lenient
      // Target at least the minimum required slots
      const targetCount = Math.max(
        config.minSlots, // Must have at least minSlots
        finalFilteredSlots.length + 10 // Or at least add 10 more
      );
      const needed = targetCount - finalFilteredSlots.length;
      let added = 0;
      
      // Build clue cell set ONLY from slots we're keeping (finalFilteredSlots)
      // This allows us to re-add filtered-out slots if their clue cells aren't taken
      const clueCellSet = new Set<string>();
      for (const slot of finalFilteredSlots) {
        clueCellSet.add(`${slot.startRow},${slot.startCol}`);
      }
      
      // Get all slots that were filtered out (from validatedSlots, not original slots)
      // Use validatedSlots because those have recalculated crossings
      const filteredOutSlots = validatedSlots.filter(slot => !finalFilteredSlots.includes(slot));
      
      // Use the original crossing counts from validatedSlots (already recalculated)
      // This is more accurate than recalculating against a smaller set
      const slotsWithCrossings = filteredOutSlots.map(slot => {
        // Use the crossings that were already calculated during validation
        return { slot, crossings: slot.crossings.length };
      });
      
      // Sort by crossing count (ascending) to prefer easier slots
      slotsWithCrossings.sort((a, b) => a.crossings - b.crossings);
      
      for (const { slot, crossings } of slotsWithCrossings) {
        if (added >= needed) break;
        
        // Check if clue cell is already taken
        const clueKey = `${slot.startRow},${slot.startCol}`;
        if (clueCellSet.has(clueKey)) {
          continue; // Clue cell already taken
        }
        
        // Check if answer cells overlap with clue cells
        const slotCells = getSlotCells(slot);
        let hasClueOverlap = false;
        for (const cell of slotCells) {
          const cellKey = `${cell.row},${cell.col}`;
          if (clueCellSet.has(cellKey)) {
            hasClueOverlap = true;
            break;
          }
        }
        if (hasClueOverlap) continue; // Skip slots that overlap with clue cells
        
        // With 6M clues, we can handle more crossings - be more aggressive
        // Cap at 15 crossings for ultra-dense puzzles
        const relaxedLimit = 15;
        if (crossings <= relaxedLimit) {
          finalFilteredSlots.push(slot);
          clueCellSet.add(clueKey); // Add this slot's clue cell
          added++;
          console.log(`  ✅ Re-added slot ${slot.id} with ${crossings} crossings (relaxed limit: ${relaxedLimit})`);
        }
      }
      console.log(`  ✅ Relaxed filtering: Added ${added} more slots. Total: ${finalFilteredSlots.length}`);
    }
  }
  
  // GAP-FILLING: Add more slots to fill empty areas and increase density
  // Find empty areas and try to place additional slots
  const gapFilledSlots = [...finalFilteredSlots];
  const gapFilledAnswerCells = new Map<string, { slotId: string; position: number }>();
  const gapFilledOccupiedCells = new Set<string>();
  
  // Rebuild answer cells and occupied cells from final filtered slots
  for (const slot of finalFilteredSlots) {
    gapFilledOccupiedCells.add(`${slot.startRow},${slot.startCol}`);
    const answerCells = getSlotCells(slot);
    for (let j = 0; j < answerCells.length; j++) {
      const cell = answerCells[j];
      const cellKey = `${cell.row},${cell.col}`;
      gapFilledAnswerCells.set(cellKey, { slotId: slot.id, position: j });
    }
  }
  
  // ULTRA-DENSE: With 6M clues, aim for 99%+ coverage (almost no empty cells)
  // Calculate current coverage
  const totalCells = config.rows * config.cols;
  const currentCoverage = (gapFilledAnswerCells.size + gapFilledOccupiedCells.size) / totalCells;
  
  // Target 99%+ coverage - only 1-2% empty cells max
  // With huge clue database, we can fill almost everything
  const targetCoverage = 0.99; // 99% coverage
  const maxEmptyCells = Math.max(1, Math.floor(totalCells * (1 - targetCoverage))); // At least 1 empty, but aim for 99%
  const targetFilledCells = totalCells - maxEmptyCells;
  const currentFilledCells = gapFilledAnswerCells.size + gapFilledOccupiedCells.size;
  const cellsNeeded = Math.max(0, targetFilledCells - currentFilledCells);
  
  // ULTRA-DENSE: Keep adding slots until we reach 99%+ coverage
  // With 6M clues, we have many word options to fill every possible cell
  console.log(`  🎯 ULTRA-DENSITY target: ${targetFilledCells}/${totalCells} cells (${(targetCoverage * 100).toFixed(1)}% - almost no empty cells!)`);
  console.log(`  📊 Current: ${currentFilledCells}/${totalCells} cells (${(currentCoverage * 100).toFixed(1)}%)`);
  console.log(`  📊 Need to fill: ${cellsNeeded} more cells`);
  
  let gapFilledCount = 0;
  let gapFillAttempts = 0;
  let lastProgressCount = 0;
  let noProgressCount = 0;
  // Much higher limits with 6M clues - we can try many more combinations
  const maxGapFillAttempts = 50000; // Much higher - use the power of 6M clues
  const maxNoProgressAttempts = 5000; // More patience before giving up
  
  // Keep going until we reach target empty cells
  while (gapFillAttempts < maxGapFillAttempts) {
    gapFillAttempts++;
    
    // Progress logging every 1000 attempts
    if (gapFillAttempts % 1000 === 0) {
      const currentFilled = gapFilledAnswerCells.size + gapFilledOccupiedCells.size;
      const currentEmpty = totalCells - currentFilled;
      const currentCoverageCheck = currentFilled / totalCells;
      console.log(`  🔄 Gap-filling progress: ${gapFillAttempts}/${maxGapFillAttempts} attempts, ${currentEmpty} empty cells (${(currentCoverageCheck * 100).toFixed(1)}%), ${gapFilledCount} slots added`);
    }
    
    // Check current coverage - stop when we reach 99%+ or within 5 cells of target
    const currentFilled = gapFilledAnswerCells.size + gapFilledOccupiedCells.size;
    const currentEmpty = totalCells - currentFilled;
    const currentCoverageCheck = currentFilled / totalCells;
    
    // Early exit if we've reached target coverage (99%+)
    if (currentCoverageCheck >= targetCoverage || currentEmpty <= maxEmptyCells) {
      console.log(`  ✅ Gap-filling complete: ${currentEmpty} empty cells (${(currentCoverageCheck * 100).toFixed(1)}% coverage) with ${gapFilledCount} additional slots`);
      break;
    }
    
    // Early exit if we're very close (within 5 cells)
    if (currentEmpty <= maxEmptyCells + 5) {
      console.log(`  ✅ Gap-filling: Very close to target (${currentEmpty} empty cells, ${(currentCoverageCheck * 100).toFixed(1)}% coverage) with ${gapFilledCount} additional slots`);
      break;
    }
    
    // Early exit if no progress for too long - but be more patient with 6M clues
    if (gapFilledCount === lastProgressCount) {
      noProgressCount++;
      // Only exit if we're very close to target (within 10 cells) OR no progress for very long
      const closeToTarget = currentEmpty <= maxEmptyCells + 10;
      if (noProgressCount >= maxNoProgressAttempts && !closeToTarget) {
        console.log(`  ⚠️  Gap-filling: No progress for ${maxNoProgressAttempts} attempts, but continuing...`);
        // Reset counter and keep trying - with 6M clues we should find solutions
        noProgressCount = 0;
      } else if (noProgressCount >= maxNoProgressAttempts * 3) {
        // After 3x the normal limit, give up
        console.log(`  ⚠️  Gap-filling: No progress for ${maxNoProgressAttempts * 3} attempts, stopping`);
        console.log(`  📊 Final: ${currentEmpty} empty cells (${(currentCoverageCheck * 100).toFixed(1)}% coverage) with ${gapFilledCount} additional slots`);
        break;
      }
    } else {
      lastProgressCount = gapFilledCount;
      noProgressCount = 0;
    }
    
    if (currentEmpty <= maxEmptyCells) {
      console.log(`  ✅ Reached target density: ${currentEmpty} empty cells (${(currentCoverageCheck * 100).toFixed(1)}% coverage)`);
      break;
    }
    
    // With 6M clues, keep going until we reach 99%+ coverage
    // Don't exit early - we have the word database to fill almost everything
    
    // Find ALL empty cells - prioritize those that will fill the most empty cells
    const emptyCells: Array<{ row: number; col: number; emptyNeighbors: number }> = [];
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < config.cols; c++) {
        const cellKey = `${r},${c}`;
        if (!gapFilledOccupiedCells.has(cellKey) && !gapFilledAnswerCells.has(cellKey)) {
          // Count how many empty neighbors this cell has (potential for filling)
          let emptyNeighbors = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const checkRow = r + dr;
              const checkCol = c + dc;
              if (checkRow >= 0 && checkRow < config.rows && checkCol >= 0 && checkCol < config.cols) {
                const checkKey = `${checkRow},${checkCol}`;
                if (!gapFilledOccupiedCells.has(checkKey) && !gapFilledAnswerCells.has(checkKey)) {
                  emptyNeighbors++;
                }
              }
            }
          }
          emptyCells.push({ row: r, col: c, emptyNeighbors });
        }
      }
    }
    
    if (emptyCells.length === 0) break; // No more empty cells
    
    // Prioritize cells with many empty neighbors (will fill more cells)
    emptyCells.sort((a, b) => b.emptyNeighbors - a.emptyNeighbors);
    // Pick from top 30% of cells with most empty neighbors
    const topCells = emptyCells.slice(0, Math.max(1, Math.floor(emptyCells.length * 0.3)));
    
    // Pick a random cell from top candidates (those with most empty neighbors)
    const targetCell = topCells[Math.floor(Math.random() * topCells.length)];
    
    // Try to place a slot starting near this cell
    const direction = allDirections[Math.floor(Math.random() * allDirections.length)];
    let startRow = targetCell.row;
    let startCol = targetCell.col;
    
    // Adjust for direction constraints
    if (direction === 'left-down' && startCol < 3) startCol = Math.max(3, startCol);
    if (direction === 'up-across' && startRow < 2) startRow = Math.max(2, startRow);
    if (direction === 'right-down' && startCol >= config.cols - 1) startCol = Math.max(0, config.cols - 2);
    if (direction === 'down-across' && startRow >= config.rows - 1) startRow = Math.max(0, config.rows - 2);
    
    // Prefer shorter words for gap filling (3-6 letters) to pack tighter and fill more gaps
    // Very short words can fill tiny gaps and create more crossings
    const wordLength = Math.floor(Math.random() * 4) + 3;
    
    const tempSlot: ClueSlot = {
      id: 'gap_fill',
      direction,
      startRow,
      startCol,
      length: wordLength,
      crossings: []
    };
    
    const answerCellsForSlot = getSlotCells(tempSlot);
    
    // Check bounds
    const lastCell = answerCellsForSlot[answerCellsForSlot.length - 1];
    if (lastCell.row < 0 || lastCell.row >= config.rows || lastCell.col < 0 || lastCell.col >= config.cols) {
      continue;
    }
    
    // Check if clue cell is available
    const clueKey = `${startRow},${startCol}`;
    if (gapFilledOccupiedCells.has(clueKey)) {
      continue;
    }
    
    // Check for conflicts - CRITICAL: answer cells cannot overlap with clue cells
    let canPlace = true;
    let crossingCount = 0;
    const crossingSlots = new Set<string>();
    
    // First check: make sure clue cell itself is available
    if (gapFilledOccupiedCells.has(clueKey)) {
      canPlace = false;
    }
    
    // Second check: make sure answer cells don't overlap with clue cells
    if (canPlace) {
    for (const cell of answerCellsForSlot) {
      const cellKey = `${cell.row},${cell.col}`;
      
      // CRITICAL: Answer cells cannot be in clue cells
      if (gapFilledOccupiedCells.has(cellKey)) {
        canPlace = false;
        break;
      }
      
      // Count crossings with other slots
      if (gapFilledAnswerCells.has(cellKey)) {
        const existingSlot = gapFilledAnswerCells.get(cellKey);
        if (existingSlot) {
          crossingSlots.add(existingSlot.slotId);
          }
        }
      }
    }
    
    crossingCount = crossingSlots.size; // Number of different slots we cross with
    
    // MAXIMUM DENSITY: Allow many crossings during gap filling
    // Count how many empty cells this slot would fill
    let emptyCellsFilled = 0;
    for (const cell of answerCellsForSlot) {
      const cellKey = `${cell.row},${cell.col}`;
      if (!gapFilledOccupiedCells.has(cellKey) && !gapFilledAnswerCells.has(cellKey)) {
        emptyCellsFilled++;
      }
    }
    
    // For gap-filling with 6M clues, be ULTRA-lenient - allow up to 20 crossings
    // Priority is filling empty cells - crossings don't matter as much here
    // These slots are added AFTER initial solve, so they can have more constraints
    if (canPlace && crossingCount <= 20) {
      // STRONGLY prefer slots that fill empty cells
      // If we have many empty cells, only accept slots that fill at least 2
      // If we're close to target, accept ANY slot that fills at least 1
      const currentEmpty = totalCells - (gapFilledAnswerCells.size + gapFilledOccupiedCells.size);
      const minEmptyCellsToFill = currentEmpty > maxEmptyCells + 15 ? 2 : 1;
      if (emptyCellsFilled < minEmptyCellsToFill && Math.random() < 0.85) {
        continue; // 85% chance to skip slots that don't fill enough empty cells
      }
      const gapSlotId = `gap_slot_${slotNumber}`;
      const gapSlot: ClueSlot = {
        id: gapSlotId,
        direction,
        startRow,
        startCol,
        length: wordLength,
        crossings: []
      };
      
      gapFilledSlots.push(gapSlot);
      gapFilledOccupiedCells.add(clueKey);
      
      for (let j = 0; j < answerCellsForSlot.length; j++) {
        const cell = answerCellsForSlot[j];
        const cellKey = `${cell.row},${cell.col}`;
        gapFilledAnswerCells.set(cellKey, { slotId: gapSlotId, position: j });
      }
      
      gapFilledCount++;
      slotNumber++;
      
      // Update coverage tracking
      const newFilled = gapFilledAnswerCells.size + gapFilledOccupiedCells.size;
      const newEmpty = totalCells - newFilled;
      const newCoverage = newFilled / totalCells;
      
      if (newEmpty <= maxEmptyCells) {
        // We've reached target (5 empty cells max for xlarge)
        console.log(`  ✅ Gap-filling complete: ${newEmpty} empty cells (${(newCoverage * 100).toFixed(1)}% coverage) with ${gapFilledCount} additional slots`);
        break;
      }
      
      // Also stop if we're very close (within 5 cells) and have added reasonable slots
      if (newEmpty <= maxEmptyCells + 5 && gapFilledCount >= 5) {
        console.log(`  ✅ Gap-filling: ${newEmpty} empty cells (${(newCoverage * 100).toFixed(1)}% coverage) with ${gapFilledCount} additional slots`);
        break;
      }
      
      // Early exit if we have good coverage
      if (newCoverage >= 0.95 && gapFilledCount >= 5) {
        console.log(`  ✅ Gap-filling: Good coverage achieved (${(newCoverage * 100).toFixed(1)}%) with ${gapFilledCount} additional slots`);
        break;
      }
      
      // If we're making progress but not there yet, continue
      // Don't stop early - keep going until we're close
    }
  }
  
  if (gapFilledCount > 0) {
    console.log(`  ✅ Gap-filling: Added ${gapFilledCount} additional slots to increase density`);
  }
  
  // Recalculate crossings for gap-filled slots
  for (let i = 0; i < gapFilledSlots.length; i++) {
    const slot = gapFilledSlots[i];
    const slotCells = getSlotCells(slot);
    
    for (let j = i + 1; j < gapFilledSlots.length; j++) {
      const otherSlot = gapFilledSlots[j];
      const otherCells = getSlotCells(otherSlot);
      
      for (let pos = 0; pos < slotCells.length; pos++) {
        const cell = slotCells[pos];
        for (let otherPos = 0; otherPos < otherCells.length; otherPos++) {
          const otherCell = otherCells[otherPos];
          if (cell.row === otherCell.row && cell.col === otherCell.col) {
            slot.crossings.push({
              slotId: otherSlot.id,
              thisPosition: pos,
              otherPosition: otherPos
            });
            otherSlot.crossings.push({
              slotId: slot.id,
              thisPosition: otherPos,
              otherPosition: pos
            });
          }
        }
      }
    }
  }
  
  // CRITICAL: Validate that gap-filled slots' answer cells only overlap at crossing points
  const gapFilledSlotsWithInvalidOverlaps: typeof gapFilledSlots = [];
  for (let i = 0; i < gapFilledSlots.length; i++) {
    const slot = gapFilledSlots[i];
    const slotCells = getSlotCells(slot);
    const slotCellSet = new Set(slotCells.map(c => `${c.row},${c.col}`));
    
    // Check all other slots
    for (let j = 0; j < gapFilledSlots.length; j++) {
      if (i === j) continue;
      const otherSlot = gapFilledSlots[j];
      const otherCells = getSlotCells(otherSlot);
      
      // Check if there's an overlap
      for (const cell of otherCells) {
        const cellKey = `${cell.row},${cell.col}`;
        if (slotCellSet.has(cellKey)) {
          // Found an overlap - verify it's a proper crossing
          const isCrossing = slot.crossings.some(c => c.slotId === otherSlot.id);
          if (!isCrossing) {
            // Invalid overlap - answer cells share a cell but it's not a crossing!
            if (!gapFilledSlotsWithInvalidOverlaps.includes(slot)) {
              gapFilledSlotsWithInvalidOverlaps.push(slot);
            }
            if (!gapFilledSlotsWithInvalidOverlaps.includes(otherSlot)) {
              gapFilledSlotsWithInvalidOverlaps.push(otherSlot);
            }
            console.log(`  ⚠️  Invalid gap-filled overlap: ${slot.id} and ${otherSlot.id} share answer cell (${cell.row},${cell.col}) but it's not a crossing`);
          }
        }
      }
    }
  }
  
  // Remove slots with invalid overlaps
  if (gapFilledSlotsWithInvalidOverlaps.length > 0) {
    console.log(`  ⚠️  Removing ${gapFilledSlotsWithInvalidOverlaps.length} gap-filled slots with invalid answer cell overlaps`);
    const validGapFilledSlots = gapFilledSlots.filter(s => !gapFilledSlotsWithInvalidOverlaps.includes(s));
    // Clear and recalculate crossings for remaining slots
    for (const slot of validGapFilledSlots) {
      slot.crossings = [];
    }
    // Recalculate crossings for valid slots only
    for (let i = 0; i < validGapFilledSlots.length; i++) {
      const slot = validGapFilledSlots[i];
      const slotCells = getSlotCells(slot);
      for (let j = i + 1; j < validGapFilledSlots.length; j++) {
        const otherSlot = validGapFilledSlots[j];
        const otherCells = getSlotCells(otherSlot);
        for (let pos = 0; pos < slotCells.length; pos++) {
          const cell = slotCells[pos];
          for (let otherPos = 0; otherPos < otherCells.length; otherPos++) {
            const otherCell = otherCells[otherPos];
            if (cell.row === otherCell.row && cell.col === otherCell.col) {
              slot.crossings.push({
                slotId: otherSlot.id,
                thisPosition: pos,
                otherPosition: otherPos
              });
              otherSlot.crossings.push({
                slotId: slot.id,
                thisPosition: otherPos,
                otherPosition: pos
              });
              break;
            }
          }
        }
      }
    }
    // Replace gapFilledSlots with valid slots
    gapFilledSlots.length = 0;
    gapFilledSlots.push(...validGapFilledSlots);
  }
  
  // Re-sort after gap filling
  gapFilledSlots.sort((a, b) => a.crossings.length - b.crossings.length);
  
  // CRITICAL: Final validation - remove slots where answer cells overlap with clue cells
  // Build set of all clue cell positions
  const gapFilledClueCellPositions = new Set<string>();
  for (const slot of gapFilledSlots) {
    gapFilledClueCellPositions.add(`${slot.startRow},${slot.startCol}`);
  }
  
  // Filter out slots with invalid overlaps, but be lenient if we're below minimum
  const validatedGapFilledSlots: typeof gapFilledSlots = [];
  const slotsWithOverlaps: typeof gapFilledSlots = [];
  
  for (const slot of gapFilledSlots) {
    const answerCells = getSlotCells(slot);
    let hasOverlap = false;
    for (const cell of answerCells) {
      const cellKey = `${cell.row},${cell.col}`;
      if (gapFilledClueCellPositions.has(cellKey)) {
        // This answer cell overlaps with a clue cell - invalid!
        hasOverlap = true;
        break;
      }
    }
    if (!hasOverlap) {
      validatedGapFilledSlots.push(slot);
    } else {
      slotsWithOverlaps.push(slot);
      // Only log if we have plenty of slots
      if (validatedGapFilledSlots.length > config.minSlots * 1.2) {
        console.log(`  ⚠️  Filtered out gap-filled slot ${slot.id}: answer cells overlap with clue cells`);
      }
    }
  }
  
  // If we're below minimum, be more lenient about overlaps
  if (validatedGapFilledSlots.length < config.minSlots && slotsWithOverlaps.length > 0) {
    console.log(`  ⚠️  Below minimum slots (${validatedGapFilledSlots.length}/${config.minSlots}), being lenient with overlaps...`);
    // Sort by crossing count to prefer easier slots
    slotsWithOverlaps.sort((a, b) => a.crossings.length - b.crossings.length);
    // Keep slots with overlaps if they have reasonable crossings (max 8)
    for (const slot of slotsWithOverlaps) {
      if (validatedGapFilledSlots.length >= config.minSlots) break;
      // Cap at 8 crossings even when desperate - overlaps make it harder
      if (slot.crossings.length <= 8) {
        validatedGapFilledSlots.push(slot);
      }
    }
  }
  
  // Final filter: Remove slots with too many crossings, but be lenient if below minimum
  const finalGapFilledSlots: typeof validatedGapFilledSlots = [];
  const slotsWithManyCrossings: typeof validatedGapFilledSlots = [];
  
  for (let i = 0; i < validatedGapFilledSlots.length; i++) {
    const slot = validatedGapFilledSlots[i];
    const crossings = slot.crossings.length;
    
    // With 6M clues: Keep gap-filled slots with up to 12 crossings for ultra-dense puzzles
    const maxAllowed = 12;
    if (crossings <= maxAllowed) {
      finalGapFilledSlots.push(slot);
    } else {
      slotsWithManyCrossings.push(slot);
    }
  }
  
  // If we're below minimum, be more lenient about crossings, but cap at reasonable limit
  if (finalGapFilledSlots.length < config.minSlots && slotsWithManyCrossings.length > 0) {
    console.log(`  ⚠️  Below minimum slots (${finalGapFilledSlots.length}/${config.minSlots}), being lenient with crossings...`);
    // Sort by crossing count (ascending) to prefer easier slots
    slotsWithManyCrossings.sort((a, b) => a.crossings.length - b.crossings.length);
    // Keep slots with more crossings if we're desperate, but cap at 10 for solvability
    for (const slot of slotsWithManyCrossings) {
      if (finalGapFilledSlots.length >= config.minSlots) break;
      // With 6M clues: Allow up to 15 crossings for ultra-dense puzzles
      if (slot.crossings.length <= 15) {
      finalGapFilledSlots.push(slot);
      }
    }
  }
  
  // Final safety filter - with 6M clues, allow up to 15 crossings for ultra-dense puzzles
  // This is much higher than before because we have many more word options
  const safeSlots = finalGapFilledSlots.filter(slot => slot.crossings.length <= 15);
  const removedExcessive = finalGapFilledSlots.length - safeSlots.length;
  if (removedExcessive > 0) {
    console.warn(`  ⚠️  Removed ${removedExcessive} slots with excessive crossings (>15)`);
  }
  
  // Recalculate clue cells for safe slots
  const filteredClueCells = safeSlots.map(slot => ({
    row: slot.startRow,
    col: slot.startCol,
    direction: slot.direction
  }));
  
  // Calculate average crossings for metadata
  const avgCrossings = safeSlots.length > 0 
    ? safeSlots.reduce((sum, s) => sum + s.crossings.length, 0) / safeSlots.length 
    : 0;
  
  // Calculate grid density (percentage of cells used)
  const gridTotalCells = config.rows * config.cols;
  const usedCells = new Set<string>();
  for (const slot of safeSlots) {
    const answerCells = getSlotCells(slot);
    for (const cell of answerCells) {
      usedCells.add(`${cell.row},${cell.col}`);
    }
  }
  const densityPercent = ((usedCells.size / gridTotalCells) * 100).toFixed(1);
  
  console.log(`  📊 Final template: ${safeSlots.length} slots, ${densityPercent}% cell coverage, ${avgCrossings.toFixed(2)} avg crossings`);
  
  // Ensure we have enough slots - if below minimum, be more lenient and keep more slots
  if (safeSlots.length < config.minSlots) {
    console.warn(`⚠️  Warning: Only ${safeSlots.length} slots generated, but minimum is ${config.minSlots} for ${size} size`);
    
    // If we're below minimum, be VERY lenient and re-add filtered slots
    if (safeSlots.length < config.minSlots) {
      const needed = config.minSlots - safeSlots.length;
      let added = 0;
      
      // Re-add slots that were filtered out, but only if they have reasonable crossings
      // Sort by crossing count to prefer easier slots
      const availableSlots = validatedGapFilledSlots
        .filter(s => !safeSlots.includes(s))
        .sort((a, b) => a.crossings.length - b.crossings.length);
      
      for (const slot of availableSlots) {
        if (added >= needed) break;
        // CRITICAL: Never re-add slots with more than 10 crossings - they're unsolvable
        if (slot.crossings.length <= 10) {
          safeSlots.push(slot);
          added++;
        }
      }
      
      // If still not enough, re-add from gap-filled slots that were filtered for overlaps
      // But only if they have reasonable crossings
      if (safeSlots.length < config.minSlots) {
        const overlapFiltered = gapFilledSlots
          .filter(s => !validatedGapFilledSlots.includes(s))
          .sort((a, b) => a.crossings.length - b.crossings.length);
        
        for (const slot of overlapFiltered) {
          if (safeSlots.length >= config.minSlots) break;
          // Be desperate - add even slots with overlaps if crossings are reasonable (max 10)
          if (slot.crossings.length <= 10) {
            safeSlots.push(slot);
            added++;
          }
        }
      }
      
      if (added > 0) {
        console.log(`  ✅ Re-added ${added} slots to meet minimum requirement`);
      }
    }
  }
  
  if (safeSlots.length >= config.minSlots) {
    console.log(`  ✅ Generated ${safeSlots.length} slots (target: ${config.minSlots}-${config.maxSlots})`);
  } else {
    console.warn(`  ⚠️  Still only ${safeSlots.length} slots (need ${config.minSlots}) - template may be invalid`);
  }
  
  return {
    id: `generated_${size}_${Date.now()}`,
    name: `Generated ${size} template`,
    rows: config.rows,
    cols: config.cols,
    slots: safeSlots,
    clueCells: filteredClueCells,
    difficulty,
    categories: ['Generated'],
    metadata: {
      verified: false,
      successRate: avgCrossings <= 2 ? 0.8 : avgCrossings <= 3 ? 0.7 : 0.6,
      generated: true,
      size,
      density: config.density,
      avgCrossings: avgCrossings.toFixed(2)
    }
  };
}
