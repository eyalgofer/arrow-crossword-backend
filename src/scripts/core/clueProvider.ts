/**
 * Language-aware access to the clue databases.
 * English is backed by the CSV corpus (clueDatabase.ts),
 * Hebrew by walked תשחץ pairs (hebrewClueDatabase.ts).
 */

import { Difficulty, Language } from '../../types';
import * as englishDatabase from './clueDatabase';
import * as hebrewDatabase from './hebrewClueDatabase';

export interface ClueProvider {
  getWordPool(difficulty: Difficulty): string[];
  getCluesForWord(word: string): string[];
  getAnswerRank(word: string): number;
}

export function getClueProvider(language: Language): ClueProvider {
  return language === 'he' ? hebrewDatabase : englishDatabase;
}
