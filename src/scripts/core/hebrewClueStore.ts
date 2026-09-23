/**
 * Hebrew clue data lives in hebrewClues.json (one entry per line for readable diffs).
 *
 * Entry shape:
 *   answer            — as displayed; spaces mark multi-word answers (3,4)
 *   fillScore         — 1..5, how pleasant the word is to find in the grid
 *   category          — one of HEBREW_CATEGORIES, used for per-puzzle caps
 *   excludeFromDaily  — never place this answer in a daily
 *   clues             — plain strings (legacy, unscored) or scored objects
 */

import fs from 'fs';
import path from 'path';

export type Difficulty = 1 | 2 | 3;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: 'קל',
  2: 'בינוני',
  3: 'קשה',
};

export const HEBREW_CATEGORIES = [
  'general',
  'geography',
  'people',
  'bible',
  'culture',
  'science',
  'sport',
  'food',
  'language',
] as const;

export type HebrewCategory = (typeof HEBREW_CATEGORIES)[number];

export interface HebrewClue {
  text: string;
  difficulty?: Difficulty;
  /** 1..5 — accurate, fair, and ideally a little clever. */
  quality?: number;
}

export interface RawHebrewEntry {
  answer: string;
  clues: Array<string | HebrewClue>;
  /** Legacy answer-level difficulty; applies to clues without their own. */
  difficulty?: Difficulty;
  fillScore?: number;
  category?: HebrewCategory;
  excludeFromDaily?: boolean;
}

export const HEBREW_CLUES_PATH = path.join(__dirname, 'hebrewClues.json');

export function readHebrewClues(filePath = HEBREW_CLUES_PATH): RawHebrewEntry[] {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RawHebrewEntry[];
}

const KEY_ORDER: Array<keyof RawHebrewEntry> = [
  'answer',
  'fillScore',
  'category',
  'excludeFromDaily',
  'difficulty',
  'clues',
];

function orderedEntry(entry: RawHebrewEntry): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of KEY_ORDER) {
    if (entry[key] !== undefined) out[key] = entry[key];
  }
  return out;
}

export function writeHebrewClues(entries: RawHebrewEntry[], filePath = HEBREW_CLUES_PATH): void {
  const lines = entries.map((entry) => `  ${JSON.stringify(orderedEntry(entry))}`);
  fs.writeFileSync(filePath, `[\n${lines.join(',\n')}\n]\n`, 'utf-8');
}
