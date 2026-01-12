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
  GridCell, 
  Grid, 
  GridTemplate,
  ClueSlot,
  CrossingPoint,
  Difficulty,
  WordEntry,
  GenerationConfig,
  GenerationResult 
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
  // letter -> position -> list of words with that letter at that position
  byLetterPosition: Map<string, Map<number, string[]>>;
  // word length -> list of words
  byLength: Map<number, string[]>;
}

/**
 * Build a crossing index from a word list for O(1) lookups
 */
export function buildCrossingIndex(words: string[]): CrossingIndex {
  const byLetterPosition = new Map<string, Map<number, string[]>>();
  const byLength = new Map<number, string[]>();
  
  for (const word of words) {
    // Index by length
    if (!byLength.has(word.length)) {
      byLength.set(word.length, []);
    }
    byLength.get(word.length)!.push(word);
    
    // Index by letter at each position
    for (let pos = 0; pos < word.length; pos++) {
      const letter = word[pos];
      
      if (!byLetterPosition.has(letter)) {
        byLetterPosition.set(letter, new Map());
      }
      
      const posMap = byLetterPosition.get(letter)!;
      if (!posMap.has(pos)) {
        posMap.set(pos, []);
      }
      posMap.get(pos)!.push(word);
    }
  }
  
  return { byLetterPosition, byLength };
}

/**
 * Find words that match given constraints
 */
export function findMatchingWords(
  index: CrossingIndex,
  length: number,
  constraints: Map<number, string>, // position -> required letter
  excludeWords?: Set<string>
): string[] {
  // Start with all words of the right length
  let candidates = index.byLength.get(length) || [];
  
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
    const candidateSet = new Set(candidates);
    candidates = wordsWithLetter.filter(w => 
      candidateSet.has(w) && w.length === length
    );
  }
  
  // Remove excluded words
  if (excludeWords) {
    candidates = candidates.filter(w => !excludeWords.has(w));
  }
  
  return candidates;
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
  
  // Place each letter
  for (let i = 0; i < word.length; i++) {
    const { row, col } = cells[i];
    newCells[row][col] = word[i];
  }
  
  newPlacedWords.set(slotId, word);
  
  return {
    ...state,
    cells: newCells,
    placedWords: newPlacedWords
  };
}

/**
 * Check if a word can be placed without conflicts
 */
export function canPlaceWord(
  state: GridState,
  word: string,
  cells: Array<{ row: number; col: number }>
): boolean {
  for (let i = 0; i < word.length; i++) {
    const { row, col } = cells[i];
    
    // Check bounds
    if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) {
      return false;
    }
    
    // Check if cell is a clue cell
    if (state.clueCells.has(`${row},${col}`)) {
      return false;
    }
    
    // Check for letter conflicts
    const existing = state.cells[row][col];
    if (existing !== null && existing !== word[i]) {
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
  
  // Sort slots by most constrained first (MRV heuristic)
  const sortedSlots = [...template.slots].sort((a, b) => {
    // Prioritize slots with more crossings
    return b.crossings.length - a.crossings.length;
  });
  
  // Log slot order for debugging
  console.log(`  📋 Slot order: ${sortedSlots.map((s, i) => `${i + 1}. ${s.length} letters, ${s.crossings.length} crossings`).join(', ')}`);
  
  function backtrack(state: GridState, slotIndex: number, depth: number = 0): GridState | null {
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
    
    // Limit candidates to avoid trying too many
    const maxCandidatesToTry = 100;
    const candidatesToTry = candidates.slice(0, maxCandidatesToTry);
    
    if (candidates.length > maxCandidatesToTry && depth === 0 && attempts % 50 === 0) {
      console.log(`  📊 Slot ${slotIndex + 1}/${sortedSlots.length}: ${candidates.length} candidates, trying first ${maxCandidatesToTry}`);
    }
    
    // Try each candidate
    for (let i = 0; i < candidatesToTry.length; i++) {
      const word = candidatesToTry[i];
      
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
