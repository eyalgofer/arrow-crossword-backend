/**
 * Word Index for Fast Crossword Word Lookups
 * 
 * Pre-computes word indices for O(1) lookups by length and letter position
 */

import { normalizeWord } from './validation-utils';
import { foldHebrewLetter } from '../core/hebrewOrthography';

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
    const normalized = normalizeWord(originalWord);

    const alreadyIndexed = originalWords.has(normalized);
    const existingOriginal = originalWords.get(normalized);
    if (!existingOriginal || (originalWord.includes(' ') && !existingOriginal.includes(' '))) {
      originalWords.set(normalized, originalWord);
    }
    if (alreadyIndexed) continue;
    
    // Index by normalized length (without spaces)
    if (!byLength.has(normalized.length)) {
      byLength.set(normalized.length, []);
    }
    byLength.get(normalized.length)!.push(normalized);
    
    // Index by letter at each position. Hebrew ך/ם/ן/ף/ץ fold to כ/מ/נ/פ/צ
    // so a word-final ם can still cross a mid-word מ.
    for (let pos = 0; pos < normalized.length; pos++) {
      const letter = foldHebrewLetter(normalized[pos]);
      
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
  constraints: Map<number, string> // position -> required letter
): string[] {
  // Start with all normalized words of the right length
  let normalizedCandidates = index.byLength.get(length) || [];
  
  // Filter by each constraint
  for (const [position, letter] of constraints.entries()) {
    const posMap = index.byLetterPosition.get(foldHebrewLetter(letter));
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
  
  // Convert normalized candidates back to original words (with spaces if applicable)
  return normalizedCandidates.map(normalized => 
    index.originalWords.get(normalized) || normalized
  );
}
