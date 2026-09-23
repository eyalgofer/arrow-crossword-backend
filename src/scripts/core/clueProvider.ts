/**
 * Language-aware access to the clue databases.
 * English is backed by the CSV corpus (clueDatabase.ts),
 * Hebrew by the curated list in hebrewClues.json (hebrewClueDatabase.ts).
 */

import { Language } from '../../types';
import * as englishDatabase from './clueDatabase';
import * as hebrewDatabase from './hebrewClueDatabase';

export interface ScoredClue {
  text: string;
  difficulty: 1 | 2 | 3;
  quality: number;
}

export interface WordMeta {
  fillScore: number;
  category?: string;
  excludeFromDaily: boolean;
  tier: number;
}

export interface ClueProvider {
  getWordPool(): string[];
  getCluesForWord(word: string): string[];
  getAnswerRank(word: string): number;
  /** Only providers with scored data (Hebrew) implement these. */
  getScoredClues?(word: string): ScoredClue[];
  getWordMeta?(word: string): WordMeta | undefined;
}

export function getClueProvider(language: Language): ClueProvider {
  return language === 'he' ? hebrewDatabase : englishDatabase;
}
