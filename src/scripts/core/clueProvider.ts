/**
 * Language-aware access to the clue databases.
 * English is backed by the CSV corpus (clueDatabase.ts),
 * Hebrew by the curated list in hebrewClues.ts (hebrewClueDatabase.ts).
 */

import { Difficulty, Language } from '../../types';
import * as englishDatabase from './clueDatabase';
import * as hebrewDatabase from './hebrewClueDatabase';

export interface ClueProvider {
  getWordPool(difficulty: Difficulty): string[];
  getCluesForWord(word: string): string[];
  getAnswerRank(word: string): number;
  /** True when the answer was explicitly tagged difficulty 1 (everyday Hebrew vocab). */
  isEasyVocab?(word: string): boolean;
}

export function getClueProvider(language: Language): ClueProvider {
  return language === 'he' ? hebrewDatabase : englishDatabase;
}
