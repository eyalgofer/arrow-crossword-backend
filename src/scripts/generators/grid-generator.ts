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
  
  // CRITICAL FIX: Sort slots by LEAST constrained first (reverse MRV)
  // For crossword generation, we want to solve EASIEST slots first to build up the grid
  // Then use those letters to help solve harder slots
  // This is opposite of standard CSP - we solve fewest crossings first
  const sortedSlots = [...template.slots].sort((a, b) => {
    // Prioritize slots with FEWER crossings (easier to solve first)
    return a.crossings.length - b.crossings.length;
  });
  
  // Log slot order for debugging
  console.log(`  📋 Slot order: ${sortedSlots.map((s, i) => `${i + 1}. ${s.length} letters, ${s.crossings.length} crossings`).join(', ')}`);
  
  // Track stuck states to detect infinite loops
  const stuckStates = new Map<string, number>(); // state signature -> attempt count
  
  function backtrack(state: GridState, slotIndex: number, depth: number = 0): GridState | null {
    // Increment attempts to track exploration depth
    // This counts how many times we've entered the backtrack function
    attempts++;
    
    // Detect if we're stuck in a loop (same slot, many attempts)
    if (depth === 0 && slotIndex < sortedSlots.length) {
      const stateSignature = `${slotIndex}_${Array.from(state.placedWords.keys()).sort().join(',')}`;
      const previousAttempt = stuckStates.get(stateSignature) || 0;
      const attemptsSinceLast = attempts - previousAttempt;
      
      // If we've tried this exact state 5000+ times, we're stuck
      if (previousAttempt > 0 && attemptsSinceLast > 5000) {
        console.log(`  ⚠️  Detected stuck state at slot ${slotIndex + 1}/${sortedSlots.length} after ${attemptsSinceLast} attempts`);
        console.log(`     Placed words: ${Array.from(state.placedWords.values()).join(', ')}`);
        stuckStates.delete(stateSignature); // Reset to allow retry
        return null; // Exit this branch
      }
      
      if (previousAttempt === 0 || attemptsSinceLast > 1000) {
        stuckStates.set(stateSignature, attempts);
      }
    }
    
    // Debug: log when we're at slot 3 (after placing slot 1 and slot 2)
    if (depth === 1 && slotIndex === 2 && attempts <= 1000) {
      const slot = sortedSlots[slotIndex];
      const cells = getSlotCells(slot);
      const constraints = getCrossingConstraints(state, cells);
      const placedWords = Array.from(state.placedWords.values());
      const constraintInfo = constraints.size > 0 
        ? ` with ${constraints.size} constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
        : ' (no constraints)';
      const excludeWords = config.allowWordReuse === false 
        ? new Set(state.placedWords.values())
        : undefined;
      const candidates = findMatchingWords(wordIndex, slot.length, constraints, excludeWords);
      console.log(`  🔍 [Depth 1] Attempt ${attempts}: Slot ${slotIndex + 1}/${sortedSlots.length} (${slot.length} letters${constraintInfo})`);
      console.log(`     Placed words: ${placedWords.join(', ')}`);
      console.log(`     Candidates: ${candidates.length}`);
      if (candidates.length === 0) {
        console.log(`     ❌ Slot 3 has NO candidates - this is why we're failing!`);
      } else if (candidates.length <= 10) {
        console.log(`     Slot 3 candidates: ${candidates.join(', ')}`);
      }
    }
    
    // Progress logging every 10k attempts
    if (attempts % 10000 === 0 && depth === 0) {
      const placedWords = Array.from(state.placedWords.values());
      console.log(`  🔄 Solver progress: ${attempts}/${config.maxAttempts} attempts, ${placedWords.length}/${sortedSlots.length} slots filled`);
    }
    
    if (attempts > config.maxAttempts) {
      if (attempts === config.maxAttempts + 1) {
        console.log(`  ⚠️  Max attempts (${config.maxAttempts}) reached. Progress: ${slotIndex}/${sortedSlots.length} slots filled`);
        // Show what we've placed so far
        const placedWords = Array.from(state.placedWords.values());
        if (placedWords.length > 0) {
          console.log(`     Placed words: ${placedWords.join(', ')}`);
        }
        // Show the current slot that's failing
        if (slotIndex < sortedSlots.length) {
          const currentSlot = sortedSlots[slotIndex];
          const cells = getSlotCells(currentSlot);
          const constraints = getCrossingConstraints(state, cells);
          const constraintInfo = constraints.size > 0 
            ? ` with ${constraints.size} constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
            : ' (no constraints)';
          console.log(`     Current slot: ${currentSlot.length} letters${constraintInfo}`);
        }
      }
      return null;
    }
    
    // All slots filled successfully
    if (slotIndex >= sortedSlots.length) {
      if (depth === 0) {
        console.log(`  ✅ All slots filled successfully!`);
      }
      return state;
    }
    
    const slot = sortedSlots[slotIndex];
    const cells = getSlotCells(slot);
    
    // Get constraints from existing letters
    const constraints = getCrossingConstraints(state, cells);
    
    // Find candidate words
    // Only exclude words if allowWordReuse is false
    const excludeWords = config.allowWordReuse === false 
      ? new Set(state.placedWords.values())
      : undefined;
    
    let candidates = findMatchingWords(
      wordIndex,
      slot.length,
      constraints,
      excludeWords
    );
    
    // Log first attempt for each slot (only at top level)
    if (depth === 0 && attempts === 1) {
      const constraintInfo = constraints.size > 0 
        ? ` with ${constraints.size} constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
        : ' (no constraints)';
      console.log(`  📍 Slot ${slotIndex + 1}/${sortedSlots.length} (${slot.length} letters${constraintInfo}): ${candidates.length} candidates`);
      
      // If no candidates, show why
      if (candidates.length === 0) {
        console.log(`     ❌ No candidates found for ${slot.length}-letter word${constraintInfo}`);
        // Show all words of this length
        const allWordsOfLength = Array.from(wordIndex.byLength.get(slot.length) || []);
        console.log(`     All ${slot.length}-letter words: ${allWordsOfLength.length} total`);
        if (constraints.size > 0) {
          console.log(`     Constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`);
        }
      }
    }
    
    if (depth === 0 && attempts <= 10) {
      const constraintInfo = constraints.size > 0
        ? ` with ${constraints.size} constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
        : ' (no constraints)';
      console.log(`  📍 Slot ${slotIndex + 1}/${sortedSlots.length} (${slot.length} letters${constraintInfo}): ${candidates.length} candidates`);
      if (candidates.length > 0 && candidates.length <= 10) {
        console.log(`     Candidates: ${candidates.slice(0, 10).join(', ')}`);
      }
    }
    
    // Log when we're about to fail (near max attempts)
    if (depth === 0 && attempts >= 950 && attempts <= 957) {
      const constraintInfo = constraints.size > 0
        ? ` with ${constraints.size} constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
        : ' (no constraints)';
      const placedWords = Array.from(state.placedWords.values());
      console.log(`  🔍 Attempt ${attempts}: Slot ${slotIndex + 1}/${sortedSlots.length} (${slot.length} letters${constraintInfo})`);
      console.log(`     Placed words: ${placedWords.length > 0 ? placedWords.join(', ') : 'none'}`);
      console.log(`     Candidates: ${candidates.length}`);
      if (candidates.length > 0 && candidates.length <= 20) {
        console.log(`     Candidate list: ${candidates.join(', ')}`);
      }
    }
    
    // Also log when we're about to try a word (for debugging backtracking)
    if (depth === 0 && attempts > 10 && attempts <= 20 && slotIndex < 3) {
      const constraintInfo = constraints.size > 0 
        ? ` with ${constraints.size} constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
        : ' (no constraints)';
      console.log(`  🔄 Slot ${slotIndex + 1}/${sortedSlots.length} (${slot.length} letters${constraintInfo}): ${candidates.length} candidates, attempt ${attempts}`);
    }
    
    if (candidates.length === 0) {
      // Debug: log why we have no candidates (always log when stuck)
      // This is the critical failure point - log it whenever it happens at top level
      if (depth === 0) {
        const constraintInfo = constraints.size > 0 
          ? ` with ${constraints.size} constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
          : ' (no constraints)';
        const wordsOfLength = wordIndex.byLength.get(slot.length) || [];
        console.log(`\n  🔍 Slot ${slotIndex + 1}/${sortedSlots.length} (${slot.length} letters${constraintInfo}): No candidates found`);
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
    
    // Limit candidates to avoid trying too many, but increase for constrained slots
    // Slots with more constraints need more candidates tried
    const constraintCount = constraints.size;
    const maxCandidatesToTry = constraintCount > 2 ? 500 : constraintCount > 1 ? 300 : 200;
    const candidatesToTry = candidates.slice(0, maxCandidatesToTry);
    
    // Early exit if no candidates at all
    if (candidates.length === 0) {
      if (depth === 0) {
        const constraintInfo = constraints.size > 0 
          ? ` with ${constraints.size} constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
          : ' (no constraints)';
        console.log(`  ❌ Slot ${slotIndex + 1}/${sortedSlots.length} (${slot.length} letters${constraintInfo}): No candidates found - impossible state`);
      }
      return null;
    }
    
    if (candidates.length > maxCandidatesToTry && depth === 0 && attempts % 50 === 0) {
      console.log(`  📊 Slot ${slotIndex + 1}/${sortedSlots.length}: ${candidates.length} candidates, trying first ${maxCandidatesToTry}`);
    }
    
    // CRITICAL: Pre-filter candidates that can actually be placed
    // This prevents trying thousands of words that will all fail
    const placeableCandidates: string[] = [];
    let checkedCount = 0;
    const maxPreCheck = Math.min(candidatesToTry.length, 1000); // Check up to 1000 candidates
    
    for (let i = 0; i < candidatesToTry.length && placeableCandidates.length < 200 && checkedCount < maxPreCheck; i++) {
      checkedCount++;
      const word = candidatesToTry[i];
      if (canPlaceWord(state, word, cells)) {
        placeableCandidates.push(word);
      }
    }
    
    // If we checked many candidates but found none that can be placed, this is likely impossible
    if (checkedCount >= 50 && placeableCandidates.length === 0 && depth === 0) {
      const constraintInfo = constraints.size > 0 
        ? ` with ${constraints.size} constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
        : ' (no constraints)';
      console.log(`  ❌ Slot ${slotIndex + 1}/${sortedSlots.length} (${slot.length} letters${constraintInfo}): Checked ${checkedCount} candidates, none can be placed`);
      console.log(`     This suggests the slot is in an impossible state - likely a constraint conflict`);
      // Show grid state around this slot
      const minRow = Math.min(...cells.map(c => c.row));
      const maxRow = Math.max(...cells.map(c => c.row));
      const minCol = Math.min(...cells.map(c => c.col));
      const maxCol = Math.max(...cells.map(c => c.col));
      console.log(`     Grid area around slot (rows ${minRow}-${maxRow}, cols ${minCol}-${maxCol}):`);
      for (let r = Math.max(0, minRow - 1); r <= Math.min(state.rows - 1, maxRow + 1); r++) {
        const row: string[] = [];
        for (let c = Math.max(0, minCol - 1); c <= Math.min(state.cols - 1, maxCol + 1); c++) {
          const letter = getLetterAt(state, r, c);
          const isClue = state.clueCells.has(`${r},${c}`);
          if (isClue) {
            row.push('?');
          } else {
            row.push(letter || '.');
          }
        }
        console.log(`       Row ${r}: ${row.join(' ')}`);
      }
      return null; // Early exit - this branch is impossible
    }
    
    // Use pre-filtered candidates if we found any, otherwise try original list (might find one)
    const finalCandidates = placeableCandidates.length > 0 ? placeableCandidates : candidatesToTry;
    
    // Try each candidate
    for (let i = 0; i < finalCandidates.length; i++) {
      const word = finalCandidates[i];
      
      // Check if we've exceeded max attempts before trying this word
      if (attempts > config.maxAttempts) {
        return null;
      }
      
      // Debug: Log why first few words fail on first slot
      if (slotIndex === 0 && i < 3 && depth === 0) {
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
      const result = backtrack(newState, slotIndex + 1, depth + 1);
      
      if (result !== null) {
        if (depth === 0) {
          console.log(`  ✅ Slot ${slotIndex + 1}/${sortedSlots.length}: Placed "${word}"`);
        }
        return result;
      }
      
      // If we're near the failure point, log what's happening
      if (depth === 0 && attempts >= 950 && attempts <= 960) {
        const placedWords = Array.from(state.placedWords.values());
        if (i === 0 || i === Math.min(5, candidatesToTry.length - 1) || i === candidatesToTry.length - 1) {
          console.log(`  🔍 Attempt ${attempts}: Slot ${slotIndex + 1}/${sortedSlots.length} trying "${word}" (${i + 1}/${candidatesToTry.length})`);
          console.log(`     Placed so far: ${placedWords.length > 0 ? placedWords.join(', ') : 'none'}`);
          // Check what the next slot would look like
          if (sortedSlots.length > slotIndex + 1) {
            const nextSlot = sortedSlots[slotIndex + 1];
            const nextCells = getSlotCells(nextSlot);
            const nextConstraints = getCrossingConstraints(newState, nextCells);
            const nextConstraintInfo = nextConstraints.size > 0 
              ? ` with ${nextConstraints.size} constraints: ${Array.from(nextConstraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
              : ' (no constraints)';
            const nextCandidates = findMatchingWords(wordIndex, nextSlot.length, nextConstraints, excludeWords);
            console.log(`     Next slot ${slotIndex + 2}/${sortedSlots.length} (${nextSlot.length} letters${nextConstraintInfo}): ${nextCandidates.length} candidates`);
            if (nextCandidates.length === 0) {
              console.log(`     ❌ Next slot has NO candidates - dead end!`);
            } else if (nextCandidates.length <= 10) {
              console.log(`     Next slot candidates: ${nextCandidates.join(', ')}`);
            }
            // Also check slot 3 if we're placing slot 2
            if (slotIndex === 1 && sortedSlots.length > 2) {
              const slot3 = sortedSlots[2];
              const slot3Cells = getSlotCells(slot3);
              const slot3Constraints = getCrossingConstraints(newState, slot3Cells);
              const slot3ConstraintInfo = slot3Constraints.size > 0 
                ? ` with ${slot3Constraints.size} constraints: ${Array.from(slot3Constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
                : ' (no constraints)';
              const slot3Candidates = findMatchingWords(wordIndex, slot3.length, slot3Constraints, excludeWords);
              console.log(`     Slot 3/${sortedSlots.length} (${slot3.length} letters${slot3ConstraintInfo}): ${slot3Candidates.length} candidates`);
              if (slot3Candidates.length === 0) {
                console.log(`     ❌ Slot 3 has NO candidates - this is the real dead end!`);
              } else if (slot3Candidates.length <= 10) {
                console.log(`     Slot 3 candidates: ${slot3Candidates.join(', ')}`);
              }
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
    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];
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
      console.log(`  ✅ Slot ${i + 1}/${sortedSlots.length}: Placed "${word}"`);
    }
    console.log(`  ✅ Solved template in ${attempts} attempts (greedy mode)`);
    return currentState;
  }
  
  const startTime = Date.now();
  const result = backtrack(initialState, 0);
  const elapsed = Date.now() - startTime;
  if (!result) {
    console.log(`  ❌ Failed to solve template after ${attempts} attempts (${elapsed}ms)`);
    // Show which slots were successfully filled
    const filledSlots = sortedSlots.slice(0, Math.min(5, sortedSlots.length));
    console.log(`     First ${filledSlots.length} slots: ${filledSlots.map(s => `${s.length} letters, ${s.crossings.length} crossings`).join(', ')}`);
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
  const minClues = template.rows === 11 && template.cols === 11 ? 18 : 
                   template.rows === 14 && template.cols === 14 ? 35 :
                   template.rows === 15 && template.cols === 15 ? 65 :
                   template.rows === 16 && template.cols === 16 ? 55 : 20;
  
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
    small: { rows: 14, cols: 14, minSlots: 50, maxSlots: 70, maxCrossingsPerSlot: 6, density: 0.97 },
    medium: { rows: 11, cols: 11, minSlots: 18, maxSlots: 80, maxCrossingsPerSlot: 6, density: 0.98 },
    large: { rows: 15, cols: 15, minSlots: 65, maxSlots: 90, maxCrossingsPerSlot: 7, density: 0.98 },
    xlarge: { rows: 16, cols: 16, minSlots: 55, maxSlots: 110, maxCrossingsPerSlot: 7, density: 0.98 }
  };
  
  const config = sizeConfig[size];
  const slots: ClueSlot[] = [];
  const clueCells: Array<{ row: number; col: number; direction: Direction }> = [];
  const occupiedCells = new Set<string>(); // Track which cells have clues
  const answerCells = new Map<string, { slotId: string; position: number }>(); // Track answer cells for crossings
  
  // Generate slots with strategic placement for dense puzzles
  let slotNumber = 1;
  const targetSlots = Math.floor(Math.random() * (config.maxSlots - config.minSlots + 1)) + config.minSlots;
  
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
    const maxPlacementAttempts = size === 'xlarge' ? 5000 : size === 'large' ? 4000 : size === 'medium' ? 3000 : 2000;
    
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
      
      // Word length range - optimized for Swedish arrow: prefer longer words to fill more cells
      // Longer words create more answer cells and better coverage with fewer clue cells
      const maxLength = size === 'small' ? 12 : size === 'medium' ? 14 : size === 'large' ? 16 : 18;
      const minLength = size === 'small' ? 5 : size === 'medium' ? 6 : size === 'large' ? 6 : 7;
      
      // SWEDISH ARROW DISTRIBUTION: Mix of lengths for better coverage and crossings
      // 30% medium (5-7), 50% long (8-10), 20% very long (11+)
      // Mix allows for better grid coverage and more crossing opportunities
      let wordLength: number;
      const rand = Math.random();
      if (rand < 0.30) {
        // Medium words: 5-7 letters (good for tight spaces and crossings)
        wordLength = Math.floor(Math.random() * 3) + 5;
      } else if (rand < 0.80) {
        // Long words: 8-10 letters (best balance for coverage and crossings)
        wordLength = Math.floor(Math.random() * 3) + 8;
      } else {
        // Very long words: 11+ letters (maximum coverage)
        wordLength = Math.floor(Math.random() * (maxLength - 10)) + 11;
      }
      
      // Ensure within bounds
      wordLength = Math.max(minLength, Math.min(maxLength, wordLength));
      
      // Create a temporary slot to calculate answer cells
      const tempSlot: ClueSlot = {
        id: 'temp',
        direction,
        startRow,
        startCol,
        length: wordLength,
        crossings: []
      };
      
      const answerCellsForSlot = getSlotCells(tempSlot);
      
      // Check if answer fits in bounds
      const lastCell = answerCellsForSlot[answerCellsForSlot.length - 1];
      const endRow = lastCell.row;
      const endCol = lastCell.col;
      
      if (endRow < 0 || endRow >= config.rows || endCol < 0 || endCol >= config.cols) {
        continue; // Try again
      }
      
      // Check if clue cell is available
      const clueKey = `${startRow},${startCol}`;
      if (occupiedCells.has(clueKey)) {
        continue; // Clue cell already taken
      }
      
      // Check if answer cells conflict with clue cells (but allow crossings with other answers)
      let canPlace = true;
      // Count crossings with OTHER SLOTS (not just overlapping cells)
      // This matches how we count crossings later during filtering
      const crossingSlots = new Set<string>();
      
      for (const cell of answerCellsForSlot) {
        const cellKey = `${cell.row},${cell.col}`;
        
        // Can't place answer in a clue cell
        if (occupiedCells.has(cellKey)) {
          canPlace = false;
          break;
        }
        
        // Count crossings with other slots (track which slots we cross with)
        if (answerCells.has(cellKey)) {
          const existingSlot = answerCells.get(cellKey);
          if (existingSlot) {
            crossingSlots.add(existingSlot.slotId);
          }
        }
      }
      
      const crossingCount = crossingSlots.size; // Number of different slots we cross with
      
      // PROGRESSIVE CROSSING LIMITS: Match filtering limits exactly
      // We need many slots for maximum density - match limits so slots survive
      const progressRatio = i / targetSlots;
      let maxAllowedCrossings: number;
      
      // Match filtering limits exactly - this ensures slots survive (more lenient now)
      if (progressRatio < 0.20) {
        maxAllowedCrossings = 5; // First 20%: max 5 crossings (matches filtering)
      } else if (progressRatio < 0.50) {
        maxAllowedCrossings = 6; // Next 30%: max 6 crossings (matches filtering)
      } else if (progressRatio < 0.80) {
        maxAllowedCrossings = 7; // Next 30%: max 7 crossings (matches filtering)
      } else {
        maxAllowedCrossings = config.maxCrossingsPerSlot; // Last 20%: up to config max (7)
      }
      
      // CRITICAL: Strictly enforce crossing limits during placement
      // This prevents placing slots that will be filtered out later
      if (crossingCount > maxAllowedCrossings) {
        continue; // Too many crossings for this stage, try a different position
      }
      
      // Don't reject at-limit crossings - we need all the slots we can get for density
      // The filtering will handle any that are truly too constrained
      
      // SWEDISH ARROW DENSITY: Aggressive preference for crossings, but don't be too strict
      // Start preferring crossings early, but allow some non-crossing slots to ensure we place enough
      if (crossingCount === 0 && i > targetSlots * 0.10) {
        // After 10% of slots, strongly prefer crossings (Swedish arrow style)
        // But be less strict if we're behind on slot count
        const progressRatio = i / targetSlots;
        const slotsBehind = (i + 1) < (targetSlots * progressRatio * 0.8);
        const skipChance = slotsBehind ? 0.85 : 0.92; // Less strict if behind, stricter if ahead
        if (Math.random() < skipChance) {
          continue; // Skip slots without crossings to maximize density
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
    
    // SOLVABILITY: Keep slots with up to 10 crossings for better solvability
    // Progressive limits: earlier slots can have fewer crossings
    // Increased limits to keep more slots and meet minimum requirements
    const progressRatio = i / validatedSlots.length;
    let maxAllowed: number;
    if (progressRatio < 0.40) {
      maxAllowed = 8; // First 40%: max 8 crossings (increased from 6)
    } else if (progressRatio < 0.80) {
      maxAllowed = 9; // Next 40%: max 9 crossings (increased from 7)
    } else {
      maxAllowed = 10; // Last 20%: max 10 crossings (increased from 8)
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
      
      // Get all slots that were filtered out (from original slots array)
      // Recalculate crossings for each filtered-out slot against finalFilteredSlots
      const filteredOutSlots = slots.filter(slot => !finalFilteredSlots.includes(slot));
      
      // Calculate crossings for each filtered-out slot
      const slotsWithCrossings = filteredOutSlots.map(slot => {
        const slotCells = getSlotCells(slot);
        const crossingSlots = new Set<string>();
        
        for (const otherSlot of finalFilteredSlots) {
          const otherCells = getSlotCells(otherSlot);
          for (const cell of slotCells) {
            for (const otherCell of otherCells) {
              if (cell.row === otherCell.row && cell.col === otherCell.col) {
                crossingSlots.add(otherSlot.id);
                break;
              }
            }
          }
        }
        
        return { slot, crossings: crossingSlots.size };
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
        
        // Be lenient when we're desperate, but cap at 10 crossings for solvability
        // Slots with more than 10 crossings are nearly impossible to solve
        const relaxedLimit = 10;
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
  
  // MAXIMUM DENSITY: Fill until we have only 5 empty cells (98%+ coverage)
  // Calculate current coverage
  const totalCells = config.rows * config.cols;
  const currentCoverage = (gapFilledAnswerCells.size + gapFilledOccupiedCells.size) / totalCells;
  
  // For xlarge: target 5 empty cells max (98% coverage)
  // For others: target similar high density
  const maxEmptyCells = size === 'xlarge' ? 5 : size === 'large' ? 4 : size === 'medium' ? 3 : 2;
  const targetFilledCells = totalCells - maxEmptyCells;
  const currentFilledCells = gapFilledAnswerCells.size + gapFilledOccupiedCells.size;
  const cellsNeeded = Math.max(0, targetFilledCells - currentFilledCells);
  
  // MAXIMUM DENSITY: Keep adding slots until we reach target (5 empty cells)
  // Don't limit by slot count - keep going until we fill the grid
  console.log(`  🎯 Density target: ${totalCells - maxEmptyCells}/${totalCells} cells (${((totalCells - maxEmptyCells) / totalCells * 100).toFixed(1)}%)`);
  console.log(`  📊 Current: ${currentFilledCells}/${totalCells} cells (${(currentCoverage * 100).toFixed(1)}%)`);
  console.log(`  📊 Need to fill: ${cellsNeeded} more cells`);
  
  let gapFilledCount = 0;
  let gapFillAttempts = 0;
  let lastProgressCount = 0;
  let noProgressCount = 0;
  // Reduced limit with early exit for no progress
  const maxGapFillAttempts = 10000; // Reduced from 100k - more reasonable limit
  const maxNoProgressAttempts = 2000; // Exit if no progress for 2000 attempts
  
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
    
    // Check current coverage - stop when we have only maxEmptyCells left
    const currentFilled = gapFilledAnswerCells.size + gapFilledOccupiedCells.size;
    const currentEmpty = totalCells - currentFilled;
    const currentCoverageCheck = currentFilled / totalCells;
    
    // Early exit if no progress for too long
    if (gapFilledCount === lastProgressCount) {
      noProgressCount++;
      if (noProgressCount >= maxNoProgressAttempts) {
        console.log(`  ⚠️  Gap-filling: No progress for ${maxNoProgressAttempts} attempts, stopping early`);
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
    
    // Also stop if we're very close (within 5 cells) and have made reasonable progress
    if (currentEmpty <= maxEmptyCells + 5 && gapFilledCount >= 5) {
      console.log(`  ✅ Close enough: ${currentEmpty} empty cells (${(currentCoverageCheck * 100).toFixed(1)}% coverage)`);
      break;
    }
    
    // Early exit if we're at good coverage (95%+) and have added some slots
    if (currentCoverageCheck >= 0.95 && gapFilledCount >= 5) {
      console.log(`  ✅ Good coverage achieved: ${currentEmpty} empty cells (${(currentCoverageCheck * 100).toFixed(1)}% coverage)`);
      break;
    }
    
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
    
    // For gap-filling, be VERY lenient with crossings - allow up to 15
    // Priority is filling empty cells - crossings don't matter as much here
    // These slots are added AFTER initial solve, so they can have more constraints
    if (canPlace && crossingCount <= 15) {
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
    
    // SOLVABILITY: Keep gap-filled slots with up to 6 crossings for solvability
    const maxAllowed = 6;
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
      // CRITICAL: Never keep slots with more than 10 crossings - they're unsolvable
      if (slot.crossings.length <= 10) {
        finalGapFilledSlots.push(slot);
      }
    }
  }
  
  // CRITICAL: Final safety filter - remove any slots with excessive crossings (unsolvable)
  // This prevents returning templates with impossible-to-solve slots
  const safeSlots = finalGapFilledSlots.filter(slot => slot.crossings.length <= 10);
  const removedExcessive = finalGapFilledSlots.length - safeSlots.length;
  if (removedExcessive > 0) {
    console.warn(`  ⚠️  Removed ${removedExcessive} slots with excessive crossings (>10) - unsolvable`);
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
