/**
 * CSP backtracking solver that fills a grid template with words.
 *
 * Uses the MRV (Minimum Remaining Values) heuristic: always fill the most
 * constrained slot next, so dead ends are discovered early.
 */

import { GridTemplate, ClueSlot } from '../core/types';
import { GridState, createEmptyGridState, placeWord, canPlaceWord, getCrossingConstraints } from './grid-state';
import { CrossingIndex, findMatchingWords } from './word-index';
import { getSlotCells } from './direction-utils';
import { normalizeWord } from './validation-utils';

export interface SolverConfig {
  maxAttempts: number;
  /** Abort after this many ms so a single solve never hangs. */
  maxSolveTimeMs?: number;
  /**
   * After image slots are filled, abort that text-fill attempt after this many
   * ms so the search can try a different catalog combination.
   */
  maxTextSliceMs?: number;
  /** Higher score = tried first. Candidates are shuffled before scoring, so equal scores stay random. */
  wordScorer?: (word: string, placedWords: string[]) => number;
  quiet?: boolean;
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function solveGrid(
  template: GridTemplate,
  wordIndex: CrossingIndex,
  config: SolverConfig
): GridState | null {
  let attempts = 0;
  const startTime = Date.now();

  const timedOut = () =>
    config.maxSolveTimeMs !== undefined && Date.now() - startTime > config.maxSolveTimeMs;

  const initialState = createEmptyGridState(template.rows, template.cols);
  for (const clueCell of template.clueCells) {
    initialState.clueCells.add(`${clueCell.row},${clueCell.col}`);
  }

  // Prefill image / fixed-answer slots so CSP never rewrites them
  let prefilledState = initialState;
  const remainingForSolve: ClueSlot[] = [];
  for (const slot of template.slots) {
    // Image blocks are non-letter footprint for the solver
    if (slot.clueType === 'image') {
      if (slot.exitRow != null && slot.exitCol != null) {
        prefilledState.clueCells.add(`${slot.exitRow},${slot.exitCol}`);
      }
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          prefilledState.clueCells.add(`${slot.startRow + dr},${slot.startCol + dc}`);
        }
      }
    }

    if (slot.clueType === 'image' && !slot.fixedAnswer && !slot.candidateAnswers?.length) {
      if (!config.quiet) {
        console.log(`  ❌ Image slot ${slot.id} has no bound answer`);
      }
      return null;
    }

    if (slot.fixedAnswer) {
      const cells = getSlotCells(slot);
      const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
      const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;
      const word = slot.fixedAnswer;
      if (!canPlaceWord(prefilledState, word, cells, rowDelta, colDelta)) {
        const normalized = normalizeWord(word);
        let why = `len ${normalized.length} vs ${cells.length} cells`;
        for (let i = 0; i < Math.min(normalized.length, cells.length); i++) {
          const { row, col } = cells[i];
          if (row < 0 || col < 0 || row >= prefilledState.rows || col >= prefilledState.cols) {
            why = `out of bounds (${row},${col})`;
            break;
          }
          if (prefilledState.clueCells.has(`${row},${col}`)) {
            why = `clue cell (${row},${col})`;
            break;
          }
        }
        console.log(
          `   … cannot prefill "${normalized}" (${slot.direction} ${slot.length}): ${why}`
        );
        return null;
      }
      prefilledState = placeWord(prefilledState, slot.id, word, cells, rowDelta, colDelta);
    } else {
      remainingForSolve.push(slot);
    }
  }

  /** Find placeable candidate words for a slot in the current state. */
  function getCandidates(state: GridState, slot: ClueSlot, limit: number): string[] {
    const cells = getSlotCells(slot);
    const constraints = getCrossingConstraints(state, cells);
    const placedAnswers = new Set(
      Array.from(state.placedWords.values()).map(w => normalizeWord(w))
    );

    const fromCatalog = Boolean(slot.candidateAnswers && slot.candidateAnswers.length > 0);
    let candidates: string[];
    if (fromCatalog) {
      candidates = slot.candidateAnswers!.filter((w) => !placedAnswers.has(normalizeWord(w)));
    } else {
      candidates = findMatchingWords(wordIndex, slot.length, constraints).filter(
        (w) => !placedAnswers.has(normalizeWord(w))
      );
    }
    if (!fromCatalog && candidates.length > limit * 4) {
      candidates = shuffleArray(candidates).slice(0, limit * 4);
    } else {
      candidates = shuffleArray(candidates);
    }

    const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
    const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;

    const placeable: string[] = [];
    const cap = fromCatalog ? candidates.length : limit;
    for (const word of candidates) {
      if (canPlaceWord(state, word, cells, rowDelta, colDelta)) {
        placeable.push(word);
        if (placeable.length >= cap) break;
      }
    }
    return placeable;
  }

  let loggedDeadEnd = false;
  function logDeadEnd(slot: ClueSlot): void {
    if (loggedDeadEnd) return;
    loggedDeadEnd = true;
    const at =
      slot.clueType === 'image' && slot.exitRow != null
        ? `block(${slot.startRow},${slot.startCol}) exit(${slot.exitRow},${slot.exitCol})`
        : `(${slot.startRow},${slot.startCol})`;
    console.log(
      `   … dead end: ${slot.clueType === 'image' ? 'image' : 'text'} ${slot.direction} ${slot.length} @ ${at}`
    );
  }

  /** MRV: pick the remaining slot with the fewest valid candidates. */
  function selectNextSlot(
    state: GridState,
    remainingSlots: ClueSlot[]
  ): { slot: ClueSlot; candidates: string[] } | null {
    let best: { slot: ClueSlot; candidates: string[] } | null = null;
    const unconstrained: ClueSlot[] = [];

    for (const slot of remainingSlots) {
      if (timedOut()) return null;
      const cells = getSlotCells(slot);
      const constrained =
        Boolean(slot.candidateAnswers?.length) ||
        getCrossingConstraints(state, cells).size > 0;
      if (!constrained) {
        unconstrained.push(slot);
        continue;
      }
      const cap = slot.candidateAnswers?.length ? 80 : 20;
      const candidates = getCandidates(state, slot, cap);
      if (candidates.length === 0) {
        logDeadEnd(slot);
        return { slot, candidates };
      }
      if (!best || candidates.length < best.candidates.length) {
        best = { slot, candidates };
      }
    }
    if (best) return best;
    if (unconstrained.length === 0) return null;

    // No letters placed on these slots yet. Geometry is the same for every
    // dictionary word, so one dummy probe tells us whether the slot is open.
    for (const slot of unconstrained) {
      const cells = getSlotCells(slot);
      const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
      const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;
      const dummy = 'א'.repeat(slot.length);
      if (!canPlaceWord(state, dummy, cells, rowDelta, colDelta)) {
        logDeadEnd(slot);
        return { slot, candidates: [] };
      }
    }
    const slot = unconstrained[0];
    return { slot, candidates: getCandidates(state, slot, 20) };
  }

  function imagesStillOpen(state: GridState, imageSlots: ClueSlot[]): boolean {
    for (const slot of imageSlots) {
      if (getCandidates(state, slot, 1).length === 0) {
        return false;
      }
    }
    return true;
  }

  function fillImages(state: GridState, remainingImages: ClueSlot[]): GridState | null {
    if (timedOut()) return null;
    if (remainingImages.length === 0) return state;
    const selection = selectNextSlot(state, remainingImages);
    if (!selection || selection.candidates.length === 0) return null;
    const { slot } = selection;
    const cells = getSlotCells(slot);
    const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
    const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;
    const newImages = remainingImages.filter((s) => s.id !== slot.id);
    for (const word of shuffleArray(selection.candidates)) {
      if (timedOut()) return null;
      if (!canPlaceWord(state, word, cells, rowDelta, colDelta)) continue;
      const placed = placeWord(state, slot.id, word, cells, rowDelta, colDelta);
      const result = fillImages(placed, newImages);
      if (result) return result;
    }
    return null;
  }

  function backtrack(state: GridState, remainingText: ClueSlot[], imageSlots: ClueSlot[]): GridState | null {
    if (timedOut()) return null;
    attempts++;
    if (attempts > config.maxAttempts) return null;
    if (remainingText.length === 0) {
      return fillImages(state, imageSlots);
    }

    const selection = selectNextSlot(state, remainingText);
    if (!selection || selection.candidates.length === 0) return null;

    const { slot } = selection;
    const cells = getSlotCells(slot);
    const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
    const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;

    let candidates = shuffleArray(selection.candidates);
    if (config.wordScorer) {
      const scorer = config.wordScorer;
      const placedWords = Array.from(state.placedWords.values());
      candidates.sort((a, b) => scorer(b, placedWords) - scorer(a, placedWords));
    }

    const newText = remainingText.filter((s) => s.id !== slot.id);
    const imageKeys = new Set(
      imageSlots.flatMap((imageSlot) =>
        getSlotCells(imageSlot).map((cell) => `${cell.row},${cell.col}`)
      )
    );
    const touchesImage = cells.some((cell) => imageKeys.has(`${cell.row},${cell.col}`));
    for (const word of candidates) {
      if (timedOut() || attempts > config.maxAttempts) return null;
      if (!canPlaceWord(state, word, cells, rowDelta, colDelta)) continue;

      const newState = placeWord(state, slot.id, word, cells, rowDelta, colDelta);
      if (touchesImage && !imagesStillOpen(newState, imageSlots)) continue;
      const result = backtrack(newState, newText, imageSlots);
      if (result !== null) return result;
    }
    return null;
  }

  const imageSlots = remainingForSolve.filter((slot) => slot.clueType === 'image');
  const textSlots = remainingForSolve.filter((slot) => slot.clueType !== 'image');
  for (const slot of remainingForSolve) {
    const cells = getSlotCells(slot);
    const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
    const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;
    if (slot.candidateAnswers?.length) {
      if (getCandidates(prefilledState, slot, 80).length === 0) {
        logDeadEnd(slot);
        return null;
      }
    } else if (!canPlaceWord(prefilledState, 'א'.repeat(slot.length), cells, rowDelta, colDelta)) {
      logDeadEnd(slot);
      return null;
    }
  }
  const result = backtrack(prefilledState, textSlots, imageSlots);

  if (!config.quiet) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (result) {
      console.log(`  ✅ Solved "${template.name}" (${template.slots.length} slots) in ${attempts} attempts (${elapsed}s)`);
    } else {
      console.log(`  ❌ Failed to solve "${template.name}" after ${attempts} attempts (${elapsed}s)`);
    }
  }
  return result;
}
