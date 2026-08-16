/**
 * Converts a solved grid state into a complete puzzle with clues,
 * and validates that every answer obeys the boundary rule.
 */

import { Puzzle, PuzzleItem, GridTemplate, Difficulty, Language } from '../core/types';
import { GridState } from './grid-state';
import { getSlotCells } from './direction-utils';
import { normalizeWord, validateWordBoundaries } from './validation-utils';
import { getClueProvider, ClueProvider } from '../core/clueProvider';

const MAX_CLUE_LENGTH = 50;

/**
 * Pick a clue for a word. Clues from the database are sorted best-first
 * (definitional synonyms first). We choose randomly among the top few unused
 * ones so puzzles stay varied without sacrificing quality.
 */
function pickClue(word: string, usedClues: Set<string>, provider: ClueProvider): string {
  const clues = provider.getCluesForWord(word).filter(c => c.length <= MAX_CLUE_LENGTH);
  if (clues.length === 0) {
    throw new Error(`No clue available for word "${word}" - word pool and clue database are out of sync`);
  }
  const unused = clues.filter(c => !usedClues.has(c));
  // Prefer the top 3 quality clues; fall back to unused or raw top list
  const pool = (unused.length > 0 ? unused : clues).slice(0, 3);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generatePuzzleFromGrid(
  template: GridTemplate,
  gridState: GridState,
  config: {
    title: string;
    difficulty: Difficulty;
    category: string;
    language?: Language;
  }
): Puzzle {
  const language: Language = config.language ?? 'en';
  const clueProvider = getClueProvider(language);

  const puzzleItems: PuzzleItem[] = [];
  const slotIdToClueNumber = new Map<string, number>();
  const usedClues = new Set<string>();
  const usedAnswers = new Set<string>();

  let puzzleItemNumber = 1;
  for (const slot of template.slots) {
    const word = gridState.placedWords.get(slot.id);
    if (!word) {
      throw new Error(`No word placed for slot ${slot.id}`);
    }

    const normalizedAnswer = normalizeWord(word);
    if (usedAnswers.has(normalizedAnswer)) {
      // Duplicates are prevented during solving; skip defensively if one slips through
      console.warn(`⚠️  Duplicate answer "${word}" detected - skipping clue`);
      puzzleItemNumber++;
      continue;
    }

    const clueText = pickClue(word, usedClues, clueProvider);
    usedClues.add(clueText);
    usedAnswers.add(normalizedAnswer);

    // Multi-word answers (e.g. "STAR WARS" -> [4, 4])
    const enumeration = word.split(' ').map(w => w.length);

    const clueNumber = puzzleItemNumber++;
    slotIdToClueNumber.set(slot.id, clueNumber);
    puzzleItems.push({
      number: clueNumber,
      direction: slot.direction,
      clue: clueText,
      answer: normalizedAnswer,
      enumeration,
      startRow: slot.startRow,
      startCol: slot.startCol,
    });
  }

  // --------------------------------------------------------------------------
  // Boundary validation: the cell before/after every answer must be a clue
  // cell, blocked cell, or the grid edge. Uses the same slot geometry the
  // solver filled (getSlotCells).
  // --------------------------------------------------------------------------
  const clueCellPositions = new Set<string>();
  const answerCellPositions = new Set<string>();
  for (const slot of template.slots) {
    if (!gridState.placedWords.has(slot.id)) continue;
    clueCellPositions.add(`${slot.startRow},${slot.startCol}`);
    for (const c of getSlotCells(slot)) {
      answerCellPositions.add(`${c.row},${c.col}`);
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
      validationErrors.push(`Clue #${clueNumber} (${slot.direction}): ${validation.reason}`);
    }
  }

  if (validationErrors.length > 0) {
    throw new Error(
      `Puzzle validation failed: ${validationErrors.length} clues violate boundary rule: ${validationErrors.slice(0, 5).join('; ')}`
    );
  }

  const difficultyNumber =
    config.difficulty === Difficulty.EASY ? 1 :
    config.difficulty === Difficulty.MEDIUM ? 2 :
    config.difficulty === Difficulty.CHALLENGING ? 3 :
    config.difficulty === Difficulty.HARD ? 4 : 5;

  return {
    title: config.title,
    difficulty: config.difficulty,
    category: config.category,
    language,
    grid: { rows: template.rows, cols: template.cols },
    puzzleItems,
    estimatedTime: puzzleItems.length * 20 * difficultyNumber,
    coinReward: Math.ceil((puzzleItems.length * difficultyNumber) / 4),
    metadata: {
      templateId: template.id,
      generationMethod: 'algorithmic',
    },
  };
}
