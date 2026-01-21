/**
 * Puzzle Assembler for Swedish Arrow Crossword Puzzles
 * 
 * Converts solved grid states into complete puzzles and creates templates from existing puzzles
 */

import { Puzzle, Clue, Direction, GridTemplate, ClueSlot, Difficulty } from '../core/types';
import { GridState } from './grid-state';
import { getAnswerCells, getNextCellAfterAnswer } from './direction-utils';

export interface ClueDatabase {
  getClue(word: string, difficulty: Difficulty): string;
  getAllClues?(word: string, difficulty: Difficulty): string[]; // Optional: get all available clues
}

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
  const usedAnswers = new Set<string>(); // Track used answers to prevent duplicates
  
  let clueNumber = 1;
  for (const slot of template.slots) {
    const word = gridState.placedWords.get(slot.id);
    if (!word) {
      throw new Error(`No word placed for slot ${slot.id}`);
    }
    
    // Normalize answer for duplicate checking (uppercase, no spaces)
    const normalizedAnswer = word.toUpperCase().replace(/\s+/g, '');
    
    // Check if this answer is already used
    // Note: Duplicate answers should be prevented during solving, but if one slips through,
    // we'll skip it and continue (this should be extremely rare)
    if (usedAnswers.has(normalizedAnswer)) {
      console.warn(`⚠️  Duplicate answer "${word}" detected - skipping this clue (should have been prevented during solving)`);
      clueNumber++; // Increment clue number to keep numbering sequential
      continue; // Skip this slot and continue with the next one
    }
    
    // Get clue, ensuring it's not a duplicate
    let clueText: string;
    
    // Clue text must be <= 20 characters to fit in clue cells
    const MAX_CLUE_LENGTH = 20;
    
    // Try to get all available clues if the database supports it
    if (clueDb.getAllClues) {
      const allClues = clueDb.getAllClues(word, config.difficulty);
      // Filter to only clues that fit (<= 20 characters)
      const validClues = allClues.filter(clue => clue.length <= MAX_CLUE_LENGTH);
      
      if (validClues.length === 0) {
        // No valid clues - truncate the first one
        const firstClue = allClues[0] || `[${word}]`;
        clueText = firstClue.length <= MAX_CLUE_LENGTH 
          ? firstClue 
          : firstClue.substring(0, MAX_CLUE_LENGTH - 3) + '...';
      } else {
        // Find the first valid clue that hasn't been used
        const unusedClue = validClues.find(clue => !usedClues.has(clue));
        if (unusedClue) {
          clueText = unusedClue;
        } else {
          // All valid clues for this word are used, truncate the first one if needed
          const firstValid = validClues[0];
          clueText = firstValid.length <= MAX_CLUE_LENGTH 
            ? firstValid 
            : firstValid.substring(0, MAX_CLUE_LENGTH - 3) + '...';
        }
      }
    } else {
      // Fallback: try random clues up to 10 times, ensuring they fit
      let attempts = 0;
      const maxClueAttempts = 10;
      
      do {
        clueText = clueDb.getClue(word, config.difficulty);
        // Truncate if too long
        if (clueText.length > MAX_CLUE_LENGTH) {
          clueText = clueText.substring(0, MAX_CLUE_LENGTH - 3) + '...';
        }
        attempts++;
      } while (usedClues.has(clueText) && attempts < maxClueAttempts);
      
      // If we still have a duplicate after max attempts, use a fallback
      if (usedClues.has(clueText)) {
        // Truncate the word suffix if needed
        const suffix = ` (${word})`;
        if (clueText.length + suffix.length > MAX_CLUE_LENGTH) {
          const availableSpace = MAX_CLUE_LENGTH - suffix.length;
          clueText = clueText.substring(0, Math.max(0, availableSpace - 3)) + '...' + suffix;
        } else {
          clueText = `${clueText}${suffix}`; // Add word to make it unique
        }
      }
    }
    
    // Final safety check - ensure it's still <= 20 characters
    if (clueText.length > MAX_CLUE_LENGTH) {
      clueText = clueText.substring(0, MAX_CLUE_LENGTH - 3) + '...';
    }
    
    usedClues.add(clueText);
    usedAnswers.add(normalizedAnswer);
    
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
  // Scale minimums based on grid size - smaller grids have fewer clues
  const gridArea = template.rows * template.cols;
  const minClues = gridArea <= 49 ? 6 :   // 7x7 tiny grid (EASY)
                   gridArea <= 121 ? 18 : // 11x11 medium grid (MEDIUM)
                   gridArea <= 196 ? 30 : // 14x14 grid
                   gridArea <= 225 ? 40 : // 15x15 large grid (HARD)
                   45;                    // 16x16+ xlarge grid
  
  if (clues.length < minClues) {
    // Instead of throwing, return null to allow retry
    // This prevents crashes and allows the generator to try again
    console.error(`❌ Puzzle has only ${clues.length} clues, but minimum is ${minClues} for ${template.rows}x${template.cols} grid`);
    throw new Error(`Puzzle has only ${clues.length} clues, but minimum is ${minClues} for ${template.rows}x${template.cols} grid`);
  }
  
  // --------------------------------------------------------------------------
  // FINAL VALIDATION: Ensure every clue's answer follows the boundary rule
  // For each clue, the cell after the last answer letter must be:
  // - Out of bounds (grid boundary), OR
  // - A clue cell, OR
  // - A blocked cell (neither clue nor answer)
  // --------------------------------------------------------------------------
  const clueCellPositions = new Set<string>();
  for (const clue of clues) {
    clueCellPositions.add(`${clue.startRow},${clue.startCol}`);
  }
  
  const answerCellPositions = new Set<string>();
  for (const clue of clues) {
    const cells = getAnswerCells(clue);
    for (const cell of cells) {
      answerCellPositions.add(`${cell.row},${cell.col}`);
    }
  }
  
  // Compute blocked cells: cells that are neither clue nor answer
  const blockedCellPositions = new Set<string>();
  for (let r = 0; r < template.rows; r++) {
    for (let c = 0; c < template.cols; c++) {
      const key = `${r},${c}`;
      if (!clueCellPositions.has(key) && !answerCellPositions.has(key)) {
        blockedCellPositions.add(key);
      }
    }
  }
  
  // Validate each clue
  const validationErrors: string[] = [];
  for (const clue of clues) {
    const answerCells = getAnswerCells(clue);
    if (answerCells.length === 0) continue;
    
    const lastCell = answerCells[answerCells.length - 1];
    const nextCellAfter = getNextCellAfterAnswer(clue.direction, lastCell, template.rows, template.cols);
    
    if (nextCellAfter === null) {
      // Out of bounds - valid!
      continue;
    }
    
    const nextCellKey = `${nextCellAfter.row},${nextCellAfter.col}`;
    
    // CRITICAL: The cell after the last answer letter must NOT be an answer cell
    // (Answer cells can only be at crossings, not as boundaries)
    if (answerCellPositions.has(nextCellKey)) {
      // Find which clue(s) use this cell to provide better error message
      const conflictingClues: number[] = [];
      for (const otherClue of clues) {
        if (otherClue.number === clue.number) continue;
        const otherCells = getAnswerCells(otherClue);
        for (const cell of otherCells) {
          if (cell.row === nextCellAfter.row && cell.col === nextCellAfter.col) {
            conflictingClues.push(otherClue.number);
            break;
          }
        }
      }
      validationErrors.push(
        `Clue #${clue.number} "${clue.clue}" (${clue.direction}, answer="${clue.answer}"): cell after last answer letter (${nextCellAfter.row},${nextCellAfter.col}) is an answer cell from clue(s) ${conflictingClues.join(', ')}. Last answer cell: (${lastCell.row},${lastCell.col})`
      );
      continue;
    }
    
    // Must be either a clue cell or blocked cell
    if (!clueCellPositions.has(nextCellKey) && !blockedCellPositions.has(nextCellKey)) {
      validationErrors.push(
        `Clue #${clue.number} "${clue.clue}" (${clue.direction}, answer="${clue.answer}"): cell after last answer letter (${nextCellAfter.row},${nextCellAfter.col}) is not clue/block/boundary. Last answer cell: (${lastCell.row},${lastCell.col})`
      );
    }
  }
  
  if (validationErrors.length > 0) {
    console.error(`❌ Puzzle validation failed: ${validationErrors.length} clues violate boundary rule:`);
    for (const error of validationErrors.slice(0, 10)) {
      console.error(`   └─ ${error}`);
    }
    throw new Error(`Puzzle validation failed: ${validationErrors.length} clues violate boundary rule`);
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
