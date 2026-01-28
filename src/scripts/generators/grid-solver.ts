/**
 * Grid Solver for Swedish Arrow Crossword Puzzles
 * 
 * Uses constraint satisfaction with backtracking to fill puzzle grids
 * with valid words that satisfy all crossing constraints.
 */

import { GridTemplate, ClueSlot } from '../core/types';
import { GridState, createEmptyGridState, getLetterAt, placeWord, canPlaceWord, getCrossingConstraints } from './grid-state';
import { CrossingIndex, findMatchingWords } from './word-index';
import { getSlotCells } from './direction-utils';
import { normalizeWord } from './validation-utils';

export interface SolverConfig {
  maxAttempts: number;
  /** If set, solver aborts after this many ms (avoids multi‑minute hangs). */
  maxSolveTimeMs?: number;
  shuffleWords: boolean;
  preferCommonWords: boolean;
  allowWordReuse?: boolean; // Allow words to be reused across slots
  wordScorer?: (word: string) => number;
  quiet?: boolean; // Suppress progress and solve logs
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
 * Main backtracking solver
 */
export function solveGrid(
  template: GridTemplate,
  wordIndex: CrossingIndex,
  config: SolverConfig = DEFAULT_SOLVER_CONFIG
): GridState | null {
  let attempts = 0;
  const startTime = Date.now();
  
  // Progress tracking
  const PROGRESS_MILESTONES = [0.25, 0.50, 0.75, 0.90];
  let lastMilestone = 0;
  
  // Initialize grid state with clue cells marked
  const initialState = createEmptyGridState(template.rows, template.cols);
  for (const clueCell of template.clueCells) {
    initialState.clueCells.add(`${clueCell.row},${clueCell.col}`);
  }
  
  // IMPROVED: Use true MRV (Minimum Remaining Values) heuristic
  // Dynamically select the slot with fewest valid candidates at each step
  // This is the correct CSP approach - fail fast on most constrained slots
  
  // Track stuck states to detect infinite loops (more aggressive)
  const stuckStates = new Map<string, number>(); // state signature -> attempt count
  
  /**
   * Select the next slot using MRV (Minimum Remaining Values) heuristic
   * Returns the slot with the fewest valid placeable candidates
   * OPTIMIZED: Limit candidates early and sample placeability checks for speed
   */
  function selectNextSlot(state: GridState, remainingSlots: ClueSlot[]): ClueSlot | null {
    let bestSlot: ClueSlot | null = null;
    let minCandidates = Infinity;
    
    // Pre-compute placed answers once
    const placedAnswers = Array.from(state.placedWords.values());
    const normalizedPlacedAnswers = new Set(
      placedAnswers.map(w => normalizeWord(w))
    );
    const excludeWords = config.allowWordReuse === false 
      ? new Set(placedAnswers)
      : undefined;
    
    for (const slot of remainingSlots) {
      const cells = getSlotCells(slot);
      const constraints = getCrossingConstraints(state, cells);
      
      // Find matching words
      let candidates = findMatchingWords(wordIndex, slot.length, constraints, excludeWords);
      
      // Filter out duplicate answers (normalized comparison)
      candidates = candidates.filter(w => {
        const normalized = normalizeWord(w);
        return !normalizedPlacedAnswers.has(normalized);
      });
      
      // OPTIMIZATION: Limit candidates BEFORE expensive placeability checks
      // For MRV selection, we only need an estimate, so sample if too many
      const MAX_CANDIDATES_FOR_MRV = 200; // Sample up to 200 for MRV selection
      if (candidates.length > MAX_CANDIDATES_FOR_MRV) {
        // Sample candidates for faster MRV calculation
        candidates = candidates.slice(0, MAX_CANDIDATES_FOR_MRV);
      }
      
      // Calculate direction deltas for validation
      const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
      const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;
      
      // Sample placeability checks for speed (check first 50, estimate total)
      const SAMPLE_SIZE = 50;
      const sampleCandidates = candidates.slice(0, Math.min(SAMPLE_SIZE, candidates.length));
      const validSample = sampleCandidates.filter(w => canPlaceWord(state, w, cells, rowDelta, colDelta));
      
      // Estimate valid candidates count
      let estimatedValidCount: number;
      if (candidates.length <= SAMPLE_SIZE) {
        estimatedValidCount = validSample.length;
      } else {
        // Estimate: (valid in sample / sample size) * total candidates
        const validRatio = validSample.length / sampleCandidates.length;
        estimatedValidCount = Math.floor(validRatio * candidates.length);
      }
      
      // Fail fast - if estimated valid candidates is 0, return immediately
      if (estimatedValidCount === 0) {
        return slot; // This will cause backtrack to fail fast
      }
      
      // MRV: Select slot with fewest estimated valid candidates
      if (estimatedValidCount < minCandidates) {
        minCandidates = estimatedValidCount;
        bestSlot = slot;
      }
    }
    
    return bestSlot;
  }
  
  function backtrack(state: GridState, remainingSlots: ClueSlot[], depth: number = 0): GridState | null {
    // Increment attempts to track exploration depth
    attempts++;
    // Abort if time limit exceeded (check every 1k attempts for faster timeout detection)
    if (config.maxSolveTimeMs && attempts % 1000 === 0 && (Date.now() - startTime > config.maxSolveTimeMs)) {
      return null;
    }
    
    // Detect if we're stuck in a loop
    if (depth === 0 && remainingSlots.length > 0) {
      const stateSignature = `${remainingSlots.length}_${Array.from(state.placedWords.keys()).sort().join(',')}`;
      const previousAttempt = stuckStates.get(stateSignature) || 0;
      const attemptsSinceLast = attempts - previousAttempt;
      
      // If we've tried this exact state 2000+ times, we're stuck (more aggressive)
      if (previousAttempt > 0 && attemptsSinceLast > 2000) {
        console.log(`  ⚠️  Detected stuck state with ${remainingSlots.length} slots remaining after ${attemptsSinceLast} attempts`);
        console.log(`     Placed words: ${Array.from(state.placedWords.values()).join(', ')}`);
        stuckStates.delete(stateSignature); // Reset to allow retry
        return null; // Exit this branch
      }
      
      if (previousAttempt === 0 || attemptsSinceLast > 500) {
        stuckStates.set(stateSignature, attempts);
      }
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
    
    // Track progress milestones
    if (depth === 0) {
      const totalSlots = template.slots.length;
      const placedSlots = totalSlots - remainingSlots.length;
      const progress = placedSlots / totalSlots;
      const nextMilestone = PROGRESS_MILESTONES.find(m => m > lastMilestone && progress >= m);
      if (nextMilestone && !config.quiet) {
        console.log(`  📊 Progress: ${(progress * 100).toFixed(0)}% (${placedSlots}/${totalSlots} slots, ${attempts} attempts)`);
        lastMilestone = nextMilestone;
      }
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
    // Always exclude duplicate answers (normalized: uppercase, no spaces)
    const placedAnswers = Array.from(state.placedWords.values());
    const normalizedPlacedAnswers = new Set(
      placedAnswers.map(w => normalizeWord(w))
    );
    
    // If allowWordReuse is false, also exclude exact word matches
    const excludeWords = config.allowWordReuse === false 
      ? new Set(placedAnswers)
      : undefined;
    
    let candidates = findMatchingWords(
      wordIndex,
      slot.length,
      constraints,
      excludeWords
    );
    
    // Filter out duplicate answers (normalized comparison)
    // This prevents the same answer from appearing twice in the puzzle
    candidates = candidates.filter(w => {
      const normalized = normalizeWord(w);
      return !normalizedPlacedAnswers.has(normalized);
    });
    
    // Calculate direction deltas for validation
    const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
    const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;
    
    // OPTIMIZATION: Limit candidates BEFORE expensive placeability checks
    // This dramatically speeds up the solver when there are many candidates
    const maxCandidates = constraints.size > 7 ? 400 : constraints.size > 5 ? 300 : constraints.size > 3 ? 200 : 150;
    if (candidates.length > maxCandidates * 2) {
      // If we have way too many, sample first (wordScorer will prioritize good ones)
      candidates = candidates.slice(0, maxCandidates * 2);
    }
    
    // CRITICAL IMPROVEMENT: Pre-filter candidates by placeability
    // This avoids wasting time trying words that can't be placed
    const placeableCandidates = candidates.filter(w => canPlaceWord(state, w, cells, rowDelta, colDelta));
    
    // Apply final limit after placeability filtering
    candidates = placeableCandidates.slice(0, maxCandidates);
    
    // Log first attempt for each slot (only at top level)
    if (depth === 0 && attempts === 1) {
      const constraintInfo = constraints.size > 0 
        ? ` with ${constraints.size} constraints: ${Array.from(constraints.entries()).map(([pos, letter]) => `pos${pos}='${letter}'`).join(', ')}`
        : ' (no constraints)';
      const totalSlots = template.slots.length;
      const remainingCount = remainingSlots.length;
      
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
              // word here is already normalized (from byLetterPosition index)
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
    
    // Prefer higher-scoring words (e.g. synonyms over simple) when wordScorer is provided
    // OPTIMIZATION: Only sort if we have a reasonable number of candidates
    if (config.wordScorer && candidates.length <= 500) {
      // Use partial sort for large arrays - only sort top candidates
      if (candidates.length > 200) {
        // For large arrays, partition by score instead of full sort
        const scored = candidates.map(w => ({ word: w, score: config.wordScorer!(w) }));
        scored.sort((a, b) => b.score - a.score);
        candidates = scored.map(s => s.word);
      } else {
        candidates.sort((a, b) => config.wordScorer!(b) - config.wordScorer!(a));
      }
    } else if (config.shuffleWords && candidates.length <= 500) {
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
        const canPlace = canPlaceWord(state, word, cells, rowDelta, colDelta);
        if (!canPlace) {
          // Check why it failed - use normalized word for comparison
          const normalized = normalizeWord(word);
          for (let j = 0; j < normalized.length && j < cells.length; j++) {
            const { row, col } = cells[j];
            const boundsOk = row >= 0 && row < state.rows && col >= 0 && col < state.cols;
            const isClueCell = state.clueCells.has(`${row},${col}`);
            const existing = boundsOk ? state.cells[row][col] : null;
            const conflicts = existing !== null && existing !== normalized[j];
            if (!boundsOk) {
              console.log(`     ❌ Word "${word}" fails: cell ${j} (${row},${col}) out of bounds (grid: ${state.rows}x${state.cols})`);
              break;
            } else if (isClueCell) {
              console.log(`     ❌ Word "${word}" fails: cell ${j} (${row},${col}) is a clue cell`);
              break;
            } else if (conflicts) {
              console.log(`     ❌ Word "${word}" fails: cell ${j} (${row},${col}) has '${existing}' but needs '${normalized[j]}'`);
              break;
            }
          }
        }
      }
      
      if (!canPlaceWord(state, word, cells, rowDelta, colDelta)) {
        continue;
      }
      
      const newState = placeWord(state, slot.id, word, cells, rowDelta, colDelta);
      const newRemaining = remainingSlots.filter(s => s.id !== slot.id);
      const result = backtrack(newState, newRemaining, depth + 1);
      
      if (result !== null) {
        if (depth === 0) {
          const remainingCount = newRemaining.length;
          const totalSlots = template.slots.length;
          if (!config.quiet) {
            console.log(`  ✅ Placed "${word}" (${remainingCount}/${totalSlots} remaining)`);
          }
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
            const nextRowDelta = nextCells.length >= 2 ? nextCells[1].row - nextCells[0].row : 0;
            const nextColDelta = nextCells.length >= 2 ? nextCells[1].col - nextCells[0].col : 0;
            const nextPlaceable = nextCandidates.filter(w => canPlaceWord(newState, w, nextCells, nextRowDelta, nextColDelta));
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

  if (!config.quiet) {
    console.log(`  🧩 Solving template "${template.name}" with ${template.slots.length} slots...`);
  }
  
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
      // Calculate direction deltas from cells
      const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
      const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;
      
      if (!canPlaceWord(currentState, word, cells, rowDelta, colDelta)) {
        console.log(`  ❌ Cannot place word "${word}" in slot ${i + 1}`);
        return null;
      }
      currentState = placeWord(currentState, slot.id, word, cells, rowDelta, colDelta);
      console.log(`  ✅ Slot ${i + 1}/${template.slots.length}: Placed "${word}"`);
    }
    if (!config.quiet) {
      console.log(`  ✅ Solved template in ${attempts} attempts (greedy mode)`);
    }
    return currentState;
  }
  
  const result = backtrack(initialState, [...template.slots]);
  const elapsed = Date.now() - startTime;
  if (!result) {
    console.log(`  ❌ Failed to solve template after ${attempts} attempts (${(elapsed / 1000).toFixed(1)}s)`);
    if (config.maxSolveTimeMs && elapsed >= config.maxSolveTimeMs * 0.95) {
      console.log(`  ⏱️  Time limit reached (${config.maxSolveTimeMs / 1000}s) – will retry with a new template`);
    }
  } else {
    if (!config.quiet) {
      console.log(`  ✅ Solved template in ${attempts} attempts (${(elapsed / 1000).toFixed(1)}s)`);
    }
  }
  return result;
}
