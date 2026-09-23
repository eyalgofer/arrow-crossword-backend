/**
 * Hebrew clue database for the puzzle generator.
 * Vocab is the hand-curated list in hebrewClues.json — used as written.
 */

import { applyHebrewFinalForms } from './hebrewOrthography';
import {
  Difficulty,
  HebrewCategory,
  RawHebrewEntry,
  readHebrewClues,
} from './hebrewClueStore';
import { ScoredClue, WordMeta } from './clueProvider';

/** Hebrew letters (includes final forms, which sit inside the א-ת range). */
const HEBREW_ANSWER_PATTERN = /^[\u05D0-\u05EA]{2,11}$/;

/** Must match MAX_CLUE_LENGTH_BY_LANG.he in puzzle-assembler — longer clues never fit. */
const MAX_HEBREW_CLUE_LENGTH = 28;

/** Unscored entries sit in the middle so scored good words outrank them. */
export const DEFAULT_FILL_SCORE = 3;
export const DEFAULT_CLUE_QUALITY = 3;

/**
 * Normalize a Hebrew answer to the form stored in the grid and sent to clients:
 * no spaces, regular letterforms inside the word, final letterform at the end.
 */
export function normalizeHebrewAnswer(word: string): string {
  return applyHebrewFinalForms(word.replace(/\s+/g, ''));
}

interface HebrewAnswerEntry {
  answer: string; // normalized, final letterforms applied (map key / grid)
  display: string; // original from hebrewClues.json, spaces preserved for (3,4)
  rank: number; // lower = more common (tier-weighted position)
  tier: number;
  fillScore: number;
  category?: HebrewCategory;
  excludeFromDaily: boolean;
  clues: ScoredClue[];
}

function displayForm(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function preferSpacedDisplay(current: string, incoming: string): string {
  const currentParts = current.split(' ').length;
  const incomingParts = incoming.split(' ').length;
  return incomingParts > currentParts ? incoming : current;
}

let cached: Map<string, HebrewAnswerEntry> | null = null;

function curatedClues(raw: RawHebrewEntry): ScoredClue[] {
  const fallbackDifficulty: Difficulty = raw.difficulty ?? 1;
  return (raw.clues || [])
    .map((clue) =>
      typeof clue === 'string'
        ? { text: clue, difficulty: fallbackDifficulty, quality: DEFAULT_CLUE_QUALITY }
        : {
            text: clue.text,
            difficulty: clue.difficulty ?? fallbackDifficulty,
            quality: clue.quality ?? DEFAULT_CLUE_QUALITY,
          }
    )
    .map((clue) => ({ ...clue, text: clue.text.trim() }))
    .filter((clue) => clue.text.length > 0 && clue.text.length <= MAX_HEBREW_CLUE_LENGTH);
}

function buildDatabase(): Map<string, HebrewAnswerEntry> {
  const entries = new Map<string, HebrewAnswerEntry>();

  readHebrewClues().forEach((raw: RawHebrewEntry, index: number) => {
    const answer = normalizeHebrewAnswer(raw.answer);

    if (!HEBREW_ANSWER_PATTERN.test(answer)) {
      console.warn(
        `⚠️  Hebrew clue database: skipping "${raw.answer}" - grid answers must be `
      );
      return;
    }

    const clues = curatedClues(raw);
    const display = displayForm(raw.answer);

    if (entries.has(answer)) {
      const existing = entries.get(answer)!;
      for (const clue of clues) {
        if (!existing.clues.some((c) => c.text === clue.text)) existing.clues.push(clue);
      }
      existing.display = preferSpacedDisplay(existing.display, display);
      const tier = Math.min(...clues.map((c) => c.difficulty));
      if (Number.isFinite(tier) && tier > existing.tier) existing.tier = tier;
      if (raw.fillScore !== undefined) existing.fillScore = Math.max(existing.fillScore, raw.fillScore);
      existing.category = existing.category ?? raw.category;
      existing.excludeFromDaily = existing.excludeFromDaily || raw.excludeFromDaily === true;
      return;
    }
    if (clues.length === 0) {
      console.warn(`⚠️  Hebrew clue database: "${answer}" has no clues - skipping`);
      return;
    }

    const tier = Math.min(...clues.map((c) => c.difficulty));
    const length = Array.from(answer).length;
    const lengthPenalty = length > 7 ? 140 : length < 4 ? 25 : 0;
    entries.set(answer, {
      answer,
      display,
      rank: Math.max(1, (tier - 1) * 8000 + 80 + lengthPenalty + (index % 120)),
      tier,
      fillScore: raw.fillScore ?? DEFAULT_FILL_SCORE,
      category: raw.category,
      excludeFromDaily: raw.excludeFromDaily === true,
      clues,
    });
  });

  return entries;
}

function getDatabase(): Map<string, HebrewAnswerEntry> {
  if (!cached) {
    cached = buildDatabase();
    console.log(`✅ Hebrew clue database ready: ${cached.size.toLocaleString()} answers`);
  }
  return cached;
}

// ---------------------------------------------------------------------------
// Public API (mirrors clueDatabase.ts)
// ---------------------------------------------------------------------------

/** All Hebrew answers (spaces preserved). */
export function getWordPool(): string[] {
  const db = getDatabase();
  return Array.from(db.values()).map(e => e.display);
}

/** All clue texts for an answer, in file order. */
export function getCluesForWord(word: string): string[] {
  return getScoredClues(word).map((c) => c.text);
}

/** Clues with difficulty and quality (defaults applied to unscored clues). */
export function getScoredClues(word: string): ScoredClue[] {
  const entry = getDatabase().get(normalizeHebrewAnswer(word));
  return entry ? entry.clues : [];
}

export function getWordMeta(word: string): WordMeta | undefined {
  const entry = getDatabase().get(normalizeHebrewAnswer(word));
  if (!entry) return undefined;
  return {
    fillScore: entry.fillScore,
    category: entry.category,
    excludeFromDaily: entry.excludeFromDaily,
    tier: entry.tier,
  };
}

/** Rank of an answer (lower = more common); Infinity if unknown. */
export function getAnswerRank(word: string): number {
  const db = getDatabase();
  const entry = db.get(normalizeHebrewAnswer(word));
  return entry ? entry.rank : Infinity;
}
