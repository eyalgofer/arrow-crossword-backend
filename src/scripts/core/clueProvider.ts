/**
 * Language-aware access to the clue databases.
 * English is backed by the CSV corpus (clueDatabase.ts),
 * Hebrew by the curated list in hebrewClues.json (hebrewClueDatabase.ts).
 * he-en uses the Hebrew word pool with English gloss clues.
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
  /** Only providers with scored data (Hebrew / he-en) implement these. */
  getScoredClues?(word: string): ScoredClue[];
  getWordMeta?(word: string): WordMeta | undefined;
}

/** Hebrew answers + English gloss clues for מאנגלית לעברית packs. */
const hebrewEnglishClueProvider: ClueProvider = {
  getWordPool: () => hebrewDatabase.getBilingualWordPool(),
  getCluesForWord: (word) => hebrewDatabase.getEnglishCluesForWord(word),
  getScoredClues: (word) => hebrewDatabase.getScoredEnglishClues(word),
  getAnswerRank: (word) => hebrewDatabase.getAnswerRank(word),
  getWordMeta: (word) => hebrewDatabase.getWordMeta(word),
};

/** True for languages that fill Hebrew grids (dense layouts, Hebrew orthography). */
export function isHebrewGridLanguage(language: Language): boolean {
  return language === 'he' || language === 'he-en';
}

export function getClueProvider(language: Language): ClueProvider {
  if (language === 'he-en') return hebrewEnglishClueProvider;
  if (language === 'he') return hebrewDatabase;
  return englishDatabase;
}
