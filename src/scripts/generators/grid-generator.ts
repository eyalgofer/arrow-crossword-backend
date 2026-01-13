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
  
  function backtrack(state: GridState, slotIndex: number, depth: number = 0): GridState | null {
    // Increment attempts to track exploration depth
    // This counts how many times we've entered the backtrack function
    attempts++;
    
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
    
    if (candidates.length > maxCandidatesToTry && depth === 0 && attempts % 50 === 0) {
      console.log(`  📊 Slot ${slotIndex + 1}/${sortedSlots.length}: ${candidates.length} candidates, trying first ${maxCandidatesToTry}`);
    }
    
    // Try each candidate
    for (let i = 0; i < candidatesToTry.length; i++) {
      const word = candidatesToTry[i];
      
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
  
  let clueNumber = 1;
  for (const slot of template.slots) {
    const word = gridState.placedWords.get(slot.id);
    if (!word) {
      throw new Error(`No word placed for slot ${slot.id}`);
    }
    
    const clueText = clueDb.getClue(word, config.difficulty);
    
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
    medium: { rows: 14, cols: 14, minSlots: 55, maxSlots: 80, maxCrossingsPerSlot: 6, density: 0.98 },
    large: { rows: 15, cols: 15, minSlots: 65, maxSlots: 90, maxCrossingsPerSlot: 7, density: 0.98 },
    xlarge: { rows: 16, cols: 16, minSlots: 75, maxSlots: 110, maxCrossingsPerSlot: 7, density: 0.98 }
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
      
      // Match filtering limits exactly - this ensures slots survive
      if (progressRatio < 0.30) {
        maxAllowedCrossings = 3; // First 30%: max 3 crossings (matches filtering)
      } else if (progressRatio < 0.60) {
        maxAllowedCrossings = 4; // Next 30%: max 4 crossings (matches filtering)
      } else if (progressRatio < 0.85) {
        maxAllowedCrossings = 5; // Next 25%: max 5 crossings (matches filtering)
      } else {
        maxAllowedCrossings = config.maxCrossingsPerSlot; // Last 15%: up to config max (6-7)
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
  
  // FILTERING: Strict limits for solvability - cap at 5 crossings max
  // Even with improved solver, too many crossings make puzzles unsolvable
  const filteredSlots: typeof slots = [];
  
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const crossings = slot.crossings.length;
    
    // SOLVABILITY: Lower limits to ensure puzzles are solvable
    // Progressive filtering: earlier slots (easier) can have fewer crossings
    const progressRatio = i / slots.length;
    let maxAllowed: number;
    if (progressRatio < 0.30) {
      maxAllowed = 3; // First 30%: max 3 crossings (build foundation)
    } else if (progressRatio < 0.60) {
      maxAllowed = 4; // Next 30%: max 4 crossings
    } else if (progressRatio < 0.85) {
      maxAllowed = 5; // Next 25%: max 5 crossings
    } else {
      maxAllowed = config.maxCrossingsPerSlot; // Last 15%: up to configured max (6-7)
    }
    
    // SWEDISH ARROW: Very high hard cap for maximum density - match config maxCrossingsPerSlot
    const hardCap = config.maxCrossingsPerSlot; // Use config value (7-10)
    if (crossings <= Math.min(maxAllowed, hardCap)) {
      filteredSlots.push(slot);
    } else {
      // Log when we filter out slots for debugging
      if (i < 5 || i % 10 === 0) {
        console.log(`  ⚠️  Filtered out slot ${slot.id}: ${crossings} crossings (max: ${Math.min(maxAllowed, hardCap)})`);
      }
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
  
  // Now filter again with recalculated crossings (some slots may now have fewer crossings)
  const finalFilteredSlots: typeof validatedSlots = [];
  for (let i = 0; i < validatedSlots.length; i++) {
    const slot = validatedSlots[i];
    const crossings = slot.crossings.length;
    
    // SOLVABILITY: Lower limits with recalculated crossings
    const progressRatio = i / validatedSlots.length;
    let maxAllowed: number;
    if (progressRatio < 0.30) {
      maxAllowed = 3; // First 30%: max 3 crossings
    } else if (progressRatio < 0.60) {
      maxAllowed = 4; // Next 30%: max 4 crossings
    } else if (progressRatio < 0.85) {
      maxAllowed = 5; // Next 25%: max 5 crossings
    } else {
      maxAllowed = config.maxCrossingsPerSlot; // Last 15%: up to configured max (6-7)
    }
    
    // SWEDISH ARROW: Very high hard cap for maximum density - match config maxCrossingsPerSlot
    const hardCap = config.maxCrossingsPerSlot; // Use config value (7-10)
    if (crossings <= Math.min(maxAllowed, hardCap)) {
      finalFilteredSlots.push(slot);
    } else {
      // Log when we filter out slots for debugging
      if (i < 5 || i % 10 === 0) {
        console.log(`  ⚠️  Filtered out slot ${slot.id} (recalc): ${crossings} crossings (max: ${Math.min(maxAllowed, hardCap)})`);
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
      const targetCount = Math.max(
        Math.ceil(config.minSlots * 0.7), // Try to get to 70% of min
        finalFilteredSlots.length + 10 // Or at least add 10 more
      );
      const needed = targetCount - finalFilteredSlots.length;
      let added = 0;
      
      // Build clue cell set for validation - include ALL slots (even filtered ones)
      // This ensures we don't re-add slots that overlap with clue cells from filtered slots
      const clueCellSet = new Set<string>();
      for (const slot of slots) { // Use original slots array, not just finalFilteredSlots
        clueCellSet.add(`${slot.startRow},${slot.startCol}`);
      }
      
      // Sort by crossing count (ascending) to prefer easier slots
      const sortedValidated = [...validatedSlots].sort((a, b) => {
        const aCells = getSlotCells(a);
        const bCells = getSlotCells(b);
        let aCrossings = 0;
        let bCrossings = 0;
        const aCrossingSlots = new Set<string>();
        const bCrossingSlots = new Set<string>();
        
        for (const otherSlot of finalFilteredSlots) {
          const otherCells = getSlotCells(otherSlot);
          for (const cell of aCells) {
            for (const otherCell of otherCells) {
              if (cell.row === otherCell.row && cell.col === otherCell.col) {
                aCrossingSlots.add(otherSlot.id);
                break;
              }
            }
          }
          for (const cell of bCells) {
            for (const otherCell of otherCells) {
              if (cell.row === otherCell.row && cell.col === otherCell.col) {
                bCrossingSlots.add(otherSlot.id);
                break;
              }
            }
          }
        }
        aCrossings = aCrossingSlots.size;
        bCrossings = bCrossingSlots.size;
        return aCrossings - bCrossings;
      });
      
      for (const slot of sortedValidated) {
        if (added >= needed) break;
        if (finalFilteredSlots.includes(slot)) continue;
        
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
        
        // Recalculate crossings for this slot
        let crossings = 0;
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
        crossings = crossingSlots.size;
        
        // Be VERY lenient when we're desperate - allow up to 12 crossings
        const relaxedLimit = Math.min(12, config.maxCrossingsPerSlot + 5);
        if (crossings <= relaxedLimit) {
          finalFilteredSlots.push(slot);
          clueCellSet.add(`${slot.startRow},${slot.startCol}`); // Add this slot's clue cell
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
  // No limit on attempts - keep trying until we reach target or run out of space
  const maxGapFillAttempts = 100000; // Very high limit - we'll stop when target is reached
  
  // Keep going until we reach target empty cells
  while (gapFillAttempts < maxGapFillAttempts) {
    gapFillAttempts++;
    
    // Check current coverage - stop when we have only maxEmptyCells left
    const currentFilled = gapFilledAnswerCells.size + gapFilledOccupiedCells.size;
    const currentEmpty = totalCells - currentFilled;
    const currentCoverageCheck = currentFilled / totalCells;
    
    if (currentEmpty <= maxEmptyCells) {
      console.log(`  ✅ Reached target density: ${currentEmpty} empty cells (${(currentCoverageCheck * 100).toFixed(1)}% coverage)`);
      break;
    }
    
    // Also stop if we're very close (within 3 cells) and have made progress
    if (currentEmpty <= maxEmptyCells + 3 && gapFilledCount >= 10) {
      console.log(`  ✅ Close enough: ${currentEmpty} empty cells (${(currentCoverageCheck * 100).toFixed(1)}% coverage)`);
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
      
      // Also stop if we're very close (within 3 cells) and have added reasonable slots
      if (newEmpty <= maxEmptyCells + 3 && gapFilledCount >= 10) {
        console.log(`  ✅ Gap-filling: ${newEmpty} empty cells (${(newCoverage * 100).toFixed(1)}% coverage) with ${gapFilledCount} additional slots`);
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
  
  // Re-sort after gap filling
  gapFilledSlots.sort((a, b) => a.crossings.length - b.crossings.length);
  
  // Final filter: Remove any slots that still have 6+ crossings after gap-filling
  const finalGapFilledSlots: typeof gapFilledSlots = [];
  for (let i = 0; i < gapFilledSlots.length; i++) {
    const slot = gapFilledSlots[i];
    const crossings = slot.crossings.length;
    
    // SOLVABILITY: Lower limits for gap-filled slots
    const progressRatio = i / gapFilledSlots.length;
    let maxAllowed: number;
    if (progressRatio < 0.30) {
      maxAllowed = 3;
    } else if (progressRatio < 0.60) {
      maxAllowed = 4;
    } else if (progressRatio < 0.85) {
      maxAllowed = 5;
    } else {
      maxAllowed = config.maxCrossingsPerSlot;
    }
    
    // SWEDISH ARROW: Very high hard cap for maximum density - match config maxCrossingsPerSlot
    const hardCap = config.maxCrossingsPerSlot; // Use config value (7-10)
    if (crossings <= Math.min(maxAllowed, hardCap)) {
      finalGapFilledSlots.push(slot);
    }
  }
  
  // Recalculate clue cells for final gap-filled slots
  const filteredClueCells = finalGapFilledSlots.map(slot => ({
    row: slot.startRow,
    col: slot.startCol,
    direction: slot.direction
  }));
  
  // Calculate average crossings for metadata
  const avgCrossings = finalGapFilledSlots.length > 0 
    ? finalGapFilledSlots.reduce((sum, s) => sum + s.crossings.length, 0) / finalGapFilledSlots.length 
    : 0;
  
  // Calculate grid density (percentage of cells used)
  const gridTotalCells = config.rows * config.cols;
  const usedCells = new Set<string>();
  for (const slot of finalGapFilledSlots) {
    const answerCells = getSlotCells(slot);
    for (const cell of answerCells) {
      usedCells.add(`${cell.row},${cell.col}`);
    }
  }
  const densityPercent = ((usedCells.size / gridTotalCells) * 100).toFixed(1);
  
  // CRITICAL FINAL VALIDATION: Remove any slots where answer cells overlap with clue cells
  // This is the last chance to catch invalid slots before they cause solver failures
  const finalClueCellPositions = new Set<string>();
  for (const slot of finalGapFilledSlots) {
    finalClueCellPositions.add(`${slot.startRow},${slot.startCol}`);
  }
  
  const validatedFinalSlots: typeof finalGapFilledSlots = [];
  let removedCount = 0;
  for (const slot of finalGapFilledSlots) {
    const answerCells = getSlotCells(slot);
    let hasClueOverlap = false;
    for (const cell of answerCells) {
      const cellKey = `${cell.row},${cell.col}`;
      if (finalClueCellPositions.has(cellKey)) {
        hasClueOverlap = true;
        removedCount++;
        console.log(`  ⚠️  Removing invalid slot ${slot.id}: answer cell (${cell.row},${cell.col}) overlaps with clue cell`);
        break;
      }
    }
    if (!hasClueOverlap) {
      validatedFinalSlots.push(slot);
    }
  }
  
  if (removedCount > 0) {
    console.warn(`  ⚠️  Removed ${removedCount} invalid slots with clue cell overlaps`);
  }
  
  // Recalculate crossings after removing invalid slots
  for (const slot of validatedFinalSlots) {
    slot.crossings = [];
  }
  for (let i = 0; i < validatedFinalSlots.length; i++) {
    const slot = validatedFinalSlots[i];
    const slotCells = getSlotCells(slot);
    for (let j = i + 1; j < validatedFinalSlots.length; j++) {
      const otherSlot = validatedFinalSlots[j];
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
  
  // Recalculate density after validation
  const finalAnswerCells = new Set<string>();
  const finalClueCells = new Set<string>();
  for (const slot of validatedFinalSlots) {
    finalClueCells.add(`${slot.startRow},${slot.startCol}`);
    const answerCells = getSlotCells(slot);
    for (const cell of answerCells) {
      finalAnswerCells.add(`${cell.row},${cell.col}`);
    }
  }
  const finalDensity = (finalAnswerCells.size + finalClueCells.size) / (config.rows * config.cols);
  const finalDensityPercent = (finalDensity * 100).toFixed(1);
  const finalAvgCrossings = validatedFinalSlots.length > 0
    ? validatedFinalSlots.reduce((sum, s) => sum + s.crossings.length, 0) / validatedFinalSlots.length
    : 0;
  
  console.log(`  📊 Final template: ${validatedFinalSlots.length} slots, ${finalDensityPercent}% cell coverage, ${finalAvgCrossings.toFixed(2)} avg crossings`);
  
  // Ensure we have enough slots - if not, warn
  if (validatedFinalSlots.length < config.minSlots) {
    console.warn(`⚠️  Warning: Only ${validatedFinalSlots.length} slots generated, but minimum is ${config.minSlots} for ${size} size`);
  } else {
    console.log(`  ✅ Generated ${validatedFinalSlots.length} slots (target: ${config.minSlots}-${config.maxSlots})`);
  }
  
  // Build clue cells array from validated slots
  const validatedClueCells = validatedFinalSlots.map(slot => ({
    row: slot.startRow,
    col: slot.startCol,
    direction: slot.direction
  }));
  
  return {
    id: `generated_${size}_${Date.now()}`,
    name: `Generated ${size} template`,
    rows: config.rows,
    cols: config.cols,
    slots: validatedFinalSlots,
    clueCells: validatedClueCells,
    difficulty,
    categories: ['Generated'],
    metadata: {
      verified: false,
      successRate: finalAvgCrossings <= 2 ? 0.8 : finalAvgCrossings <= 3 ? 0.7 : 0.6,
      generated: true,
      size,
      density: config.density,
      avgCrossings: finalAvgCrossings.toFixed(2)
    }
  };
}
