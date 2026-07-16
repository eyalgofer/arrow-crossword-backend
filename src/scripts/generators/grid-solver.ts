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
  /** Higher score = tried first. Candidates are shuffled before scoring, so equal scores stay random. */
  wordScorer?: (word: string) => number;
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

  /** Find placeable candidate words for a slot in the current state. */
  function getCandidates(state: GridState, slot: ClueSlot, limit: number): string[] {
    const cells = getSlotCells(slot);
    const constraints = getCrossingConstraints(state, cells);
    const placedAnswers = new Set(
      Array.from(state.placedWords.values()).map(w => normalizeWord(w))
    );

    let candidates = findMatchingWords(wordIndex, slot.length, constraints)
      .filter(w => !placedAnswers.has(normalizeWord(w)));

    const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
    const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;

    const placeable: string[] = [];
    for (const word of candidates) {
      if (canPlaceWord(state, word, cells, rowDelta, colDelta)) {
        placeable.push(word);
        if (placeable.length >= limit) break;
      }
    }
    return placeable;
  }

  /** MRV: pick the remaining slot with the fewest valid candidates. */
  function selectNextSlot(
    state: GridState,
    remainingSlots: ClueSlot[]
  ): { slot: ClueSlot; candidates: string[] } | null {
    let best: { slot: ClueSlot; candidates: string[] } | null = null;

    for (const slot of remainingSlots) {
      if (timedOut()) return null;
      const candidates = getCandidates(state, slot, 60);
      if (candidates.length === 0) {
        return { slot, candidates }; // dead end - fail fast
      }
      if (!best || candidates.length < best.candidates.length) {
        best = { slot, candidates };
      }
    }
    return best;
  }

  function backtrack(state: GridState, remainingSlots: ClueSlot[]): GridState | null {
    if (timedOut()) return null;
    attempts++;
    if (attempts > config.maxAttempts) return null;
    if (remainingSlots.length === 0) return state;

    const selection = selectNextSlot(state, remainingSlots);
    if (!selection || selection.candidates.length === 0) return null;

    const { slot } = selection;
    const cells = getSlotCells(slot);
    const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
    const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;

    let candidates = shuffleArray(selection.candidates);
    if (config.wordScorer) {
      const scorer = config.wordScorer;
      candidates.sort((a, b) => scorer(b) - scorer(a));
    }

    const newRemaining = remainingSlots.filter(s => s.id !== slot.id);
    for (const word of candidates) {
      if (timedOut() || attempts > config.maxAttempts) return null;
      if (!canPlaceWord(state, word, cells, rowDelta, colDelta)) continue;

      const newState = placeWord(state, slot.id, word, cells, rowDelta, colDelta);
      const result = backtrack(newState, newRemaining);
      if (result !== null) return result;
    }
    return null;
  }

  const result = backtrack(initialState, [...template.slots]);

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
