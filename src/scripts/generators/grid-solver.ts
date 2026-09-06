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

    for (const slot of remainingSlots) {
      if (timedOut()) return null;
      const cap = slot.candidateAnswers?.length ? 80 : 15;
      const candidates = getCandidates(state, slot, cap);
      if (candidates.length === 0) {
        logDeadEnd(slot);
        return { slot, candidates };
      }
      if (!best || candidates.length < best.candidates.length) {
        best = { slot, candidates };
      }
    }
    return best;
  }

  function textStillOpen(state: GridState, textSlots: ClueSlot[]): boolean {
    for (const slot of textSlots) {
      if (getCandidates(state, slot, 8).length === 0) {
        return false;
      }
    }
    return true;
  }

  let textSliceStart = 0;
  function backtrack(
    state: GridState,
    remainingImages: ClueSlot[],
    remainingText: ClueSlot[]
  ): GridState | null {
    if (timedOut()) return null;
    attempts++;
    if (attempts > config.maxAttempts) return null;
    if (remainingImages.length === 0 && remainingText.length === 0) return state;

    const imagePhase = remainingImages.length > 0;
    if (imagePhase) {
      textSliceStart = 0;
    } else if (config.maxTextSliceMs) {
      if (textSliceStart === 0) {
        textSliceStart = Date.now();
        if (!textStillOpen(state, remainingText)) return null;
      } else if (Date.now() - textSliceStart > config.maxTextSliceMs) {
        return null;
      }
    }

    const pool = imagePhase ? remainingImages : remainingText;
    const selection = selectNextSlot(state, pool);
    if (!selection || selection.candidates.length === 0) return null;

    const { slot } = selection;
    const cells = getSlotCells(slot);
    const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
    const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;

    let candidates = shuffleArray(selection.candidates);
    if (config.wordScorer) {
      const scorer = config.wordScorer;
      const placed = Array.from(state.placedWords.values());
      candidates.sort((a, b) => scorer(b, placed) - scorer(a, placed));
    }

    const newImages = remainingImages.filter((s) => s.id !== slot.id);
    const newText = remainingText.filter((s) => s.id !== slot.id);
    for (const word of candidates) {
      if (timedOut() || attempts > config.maxAttempts) return null;
      if (!canPlaceWord(state, word, cells, rowDelta, colDelta)) continue;

      const newState = placeWord(state, slot.id, word, cells, rowDelta, colDelta);
      if (imagePhase) {
        const imageKeys = new Set(cells.map((cell) => `${cell.row},${cell.col}`));
        const crossed = remainingText.filter((textSlot) =>
          getSlotCells(textSlot).some((cell) => imageKeys.has(`${cell.row},${cell.col}`))
        );
        if (!textStillOpen(newState, crossed)) continue;
      }
      const result = backtrack(newState, newImages, newText);
      if (result !== null) return result;
    }
    return null;
  }

  const imageSlots = remainingForSolve.filter((slot) => slot.clueType === 'image');
  const textSlots = remainingForSolve.filter((slot) => slot.clueType !== 'image');
  for (const slot of remainingForSolve) {
    const cap = slot.candidateAnswers?.length ? 80 : 8;
    if (getCandidates(prefilledState, slot, cap).length === 0) {
      logDeadEnd(slot);
      if (!config.quiet) {
        console.log(`  ❌ Failed to solve "${template.name}" after 0 attempts (0.0s)`);
      }
      return null;
    }
  }
  const result = backtrack(prefilledState, imageSlots, textSlots);

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
