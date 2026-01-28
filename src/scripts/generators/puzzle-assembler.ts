/**
 * Puzzle Assembler for Swedish Arrow Crossword Puzzles
 * 
 * Converts solved grid states into complete puzzles and creates templates from existing puzzles
 */

import { Puzzle, PuzzleItem, GridTemplate, Difficulty } from '../core/types';
import { GridState } from './grid-state';
import { getSlotCells } from './direction-utils';
import { normalizeWord, validateWordBoundaries } from './validation-utils';
import { getSynonymsDatabase } from '../core/cluesFromCSV';

export interface ClueSourceTracker {
  synonymsCount: number;
  simpleCount: number;
  trainCount: number;
}

export interface ClueDatabase {
  getClue(word: string, difficulty: Difficulty): string;
  getAllClues?(word: string, difficulty: Difficulty): string[]; // Optional: get all available clues
  tracker?: ClueSourceTracker; // Optional: track which database was used
  quiet?: boolean; // Optional: suppress statistics logging
}

const MAX_CLUE_LENGTH = 50;

/**
 * Get clue text with proper length and uniqueness handling
 */
function getClueText(
  word: string,
  clueDb: ClueDatabase,
  difficulty: Difficulty,
  maxLength: number,
  usedPuzzleItems: Set<string>
): string {
  const normalizedWord = normalizeWord(word);
  const synonymsDb = getSynonymsDatabase();
  const hasSynonymsClues = synonymsDb.byAnswer[normalizedWord]?.length > 0;

  let clueText: string;

  if (clueDb.getAllClues) {
    const allClues = clueDb.getAllClues(word, difficulty);
    const validClues = allClues.filter(clue => clue.length <= maxLength);

    if (validClues.length === 0) {
      const firstClue = allClues[0] || `[${word}]`;
      clueText = firstClue.length <= maxLength 
        ? firstClue 
        : firstClue.substring(0, maxLength - 3) + '...';
    } else {
      const unusedClue = validClues.find(clue => !usedPuzzleItems.has(clue));
      clueText = unusedClue || validClues[0];
      if (clueText.length > maxLength) {
        clueText = clueText.substring(0, maxLength - 3) + '...';
      }
    }

    // Track database usage
    if (clueDb.tracker && clueText && !clueText.startsWith('[')) {
      if (hasSynonymsClues) {
        clueDb.tracker.synonymsCount++;
      } else {
        clueDb.tracker.trainCount++;
      }
    }
  } else {
    // Fallback: try random clues up to 10 times
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      clueText = clueDb.getClue(word, difficulty);
      if (clueText.length > maxLength) {
        clueText = clueText.substring(0, maxLength - 3) + '...';
      }
      attempts++;
    } while (usedPuzzleItems.has(clueText) && attempts < maxAttempts);
    
    // If still duplicate, add word suffix
    if (usedPuzzleItems.has(clueText)) {
      const suffix = ` (${word})`;
      if (clueText.length + suffix.length > maxLength) {
        const availableSpace = maxLength - suffix.length;
        clueText = clueText.substring(0, Math.max(0, availableSpace - 3)) + '...' + suffix;
      } else {
        clueText = `${clueText}${suffix}`;
      }
    }

    // Track database usage
    if (clueDb.tracker && clueText && !clueText.startsWith('[')) {
      if (hasSynonymsClues) {
        clueDb.tracker.synonymsCount++;
      } else {
        clueDb.tracker.trainCount++;
      }
    }
  }

  // Final safety check
  if (clueText.length > maxLength) {
    clueText = clueText.substring(0, maxLength - 3) + '...';
  }

  return clueText;
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
  }
): Puzzle {
  const puzzleItems: PuzzleItem[] = [];
  const slotIdToClueNumber = new Map<string, number>(); // slot.id -> puzzle item number (for validation errors)
  const usedPuzzleItems = new Set<string>(); // Track used puzzle item texts to prevent duplicates
  const usedAnswers = new Set<string>(); // Track used answers to prevent duplicates
  
  // Initialize tracker if provided (order: synonyms → simple → train)
  if (clueDb.tracker) {
    clueDb.tracker.synonymsCount = 0;
    clueDb.tracker.simpleCount = 0;
    clueDb.tracker.trainCount = 0;
  }
  
  let puzzleItemNumber = 1;
  for (const slot of template.slots) {
    const word = gridState.placedWords.get(slot.id);
    if (!word) {
      throw new Error(`No word placed for slot ${slot.id}`);
    }
    
    // Normalize answer for duplicate checking (uppercase, no spaces)
    const normalizedAnswer = normalizeWord(word);
    
    // Check if this answer is already used
    // Note: Duplicate answers should be prevented during solving, but if one slips through,
    // we'll skip it and continue (this should be extremely rare)
    if (usedAnswers.has(normalizedAnswer)) {
      console.warn(`⚠️  Duplicate answer "${word}" detected - skipping this clue (should have been prevented during solving)`);
      puzzleItemNumber++; // Increment puzzle item number to keep numbering sequential
      continue; // Skip this slot and continue with the next one
    }
    
    // Get clue text with proper length and uniqueness handling
    const clueText = getClueText(word, clueDb, config.difficulty, MAX_CLUE_LENGTH, usedPuzzleItems);
    
    usedPuzzleItems.add(clueText);
    usedAnswers.add(normalizedAnswer);
    
    // Handle multi-word answers (e.g., "STAR WARS" -> [4, 4])
    // Use original word (with spaces) to calculate enumeration
    const words = word.split(' ');
    const enumeration = words.map(w => w.length);
    
    const clueNumber = puzzleItemNumber++;
    slotIdToClueNumber.set(slot.id, clueNumber);
    puzzleItems.push({
      number: clueNumber,
      direction: slot.direction,
      clue: clueText,
      answer: normalizedAnswer, // Use normalized answer (no spaces) for crossword grid
      enumeration: enumeration,
      startRow: slot.startRow,
      startCol: slot.startCol
    });
  }

  // --------------------------------------------------------------------------
  // Ensure every clue's answer follows the boundary rule
  // Use template slot geometry (getSlotCells) so we validate the same cells the solver filled.
  // --------------------------------------------------------------------------
  // Build clue/answer sets from template slots (getSlotCells) so we validate the same geometry the solver used.
  const clueCellPositions = new Set<string>();
  const answerCellPositions = new Set<string>();
  const cellToSlotId = new Map<string, string>();
  for (const slot of template.slots) {
    if (!gridState.placedWords.has(slot.id)) continue;
    clueCellPositions.add(`${slot.startRow},${slot.startCol}`);
    for (const c of getSlotCells(slot)) {
      const key = `${c.row},${c.col}`;
      answerCellPositions.add(key);
      cellToSlotId.set(key, slot.id);
    }
  }
  
  const blockedCellPositions = new Set<string>();
  for (let r = 0; r < template.rows; r++) {
    for (let c = 0; c < template.cols; c++) {
      const key = `${r},${c}`;
      if (!clueCellPositions.has(key) && !answerCellPositions.has(key)) {
        blockedCellPositions.add(key);
      }
    }
  }
  
  const validationErrors: string[] = [];
  for (const slot of template.slots) {
    if (!gridState.placedWords.has(slot.id)) continue;
    const answerCells = getSlotCells(slot);
    if (answerCells.length === 0) continue;
    
    const validation = validateWordBoundaries(
      slot.direction,
      answerCells,
      template.rows,
      template.cols,
      clueCellPositions,
      answerCellPositions,
      blockedCellPositions
    );
    
    if (!validation.isValid) {
      const clueNumber = slotIdToClueNumber.get(slot.id);
      const clue = puzzleItems.find(p => p.number === clueNumber);
      const clueLabel = clue ? `Clue #${clueNumber} "${clue.clue}" (${slot.direction}, answer="${clue?.answer}")` : `Slot ${slot.id} (${slot.direction})`;
      let conflictingClues: number[] = [];
      if (validation.reason) {
        const m = validation.reason.match(/\((\d+),(\d+)\)/);
        if (m) {
          const key = `${m[1]},${m[2]}`;
          const otherSlotId = cellToSlotId.get(key);
          if (otherSlotId) {
            const n = slotIdToClueNumber.get(otherSlotId);
            if (n != null) conflictingClues.push(n);
          }
        }
      }
      const conflictInfo = conflictingClues.length > 0 ? ` from clue(s) ${conflictingClues.join(', ')}` : '';
      validationErrors.push(`${clueLabel}: ${validation.reason}${conflictInfo}`);
    }
  }
  
  if (validationErrors.length > 0) {
    console.error(`❌ Puzzle validation failed: ${validationErrors.length} clues violate boundary rule:`);
    for (const error of validationErrors.slice(0, 10)) {
      console.error(`   └─ ${error}`);
    }
    throw new Error(`Puzzle validation failed: ${validationErrors.length} clues violate boundary rule`);
  }
  // Map difficulty to numeric value (1-5)
  const difficultyNumber = config.difficulty === Difficulty.EASY ? 1 :
                           config.difficulty === Difficulty.MEDIUM ? 2 :
                           config.difficulty === Difficulty.CHALLENGING ? 3 :
                           config.difficulty === Difficulty.HARD ? 4 :
                           config.difficulty === Difficulty.EXPERT ? 5 :
                           2; // Default to medium
  
  const estimatedTime = puzzleItems.length * 20 * difficultyNumber;
  const coinReward = Math.ceil(puzzleItems.length * difficultyNumber / 4);
  
  // Log clue source statistics if tracker is available and not in quiet mode
  if (clueDb.tracker && !clueDb.quiet) {
    const totalClues = clueDb.tracker.synonymsCount + clueDb.tracker.simpleCount + clueDb.tracker.trainCount;
    const synonymsPercent = totalClues > 0 ? ((clueDb.tracker.synonymsCount / totalClues) * 100).toFixed(1) : '0.0';
    const simplePercent = totalClues > 0 ? ((clueDb.tracker.simpleCount / totalClues) * 100).toFixed(1) : '0.0';
    const trainPercent = totalClues > 0 ? ((clueDb.tracker.trainCount / totalClues) * 100).toFixed(1) : '0.0';
    console.log(`\n📊 Clue Source Statistics:`);
    console.log(`   Synonyms.csv: ${clueDb.tracker.synonymsCount} clues (${synonymsPercent}%)`);
    console.log(`   Simple.csv: ${clueDb.tracker.simpleCount} clues (${simplePercent}%)`);
    console.log(`   Train.csv: ${clueDb.tracker.trainCount} clues (${trainPercent}%)`);
    console.log(`   Total clues: ${totalClues}`);
  }
  
  return {
    title: config.title,
    difficulty: config.difficulty,
    category: config.category,
    grid: { rows: template.rows, cols: template.cols },
    puzzleItems: puzzleItems,
    estimatedTime: estimatedTime,
    coinReward: coinReward,
    metadata: {
      templateId: template.id,
      generationMethod: 'algorithmic'
    }
  };
}
