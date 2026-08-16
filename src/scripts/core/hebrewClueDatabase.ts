/**
 * Curated Hebrew clue database for the puzzle generator.
 *
 * Exposes the same API as the English clueDatabase (getWordPool,
 * getCluesForWord, getAnswerRank) over the hand-curated dataset in
 * hebrewClues.ts.
 *
 * Final letterforms: answers are normalized so that כ/מ/נ/פ/צ appear as
 * ך/ם/ן/ף/ץ at the end of the word and as regular forms elsewhere — exactly
 * as players type them, since answer matching is per-character.
 */

import { Difficulty } from '../../types';
import { applyHebrewFinalForms } from './hebrewOrthography';
import { HEBREW_ENTRIES, RawHebrewEntry } from './hebrewClues';

/** Hebrew letters (includes final forms, which sit inside the א-ת range). */
const HEBREW_ANSWER_PATTERN = /^[\u05D0-\u05EA]{3,10}$/;

const MIN_ANSWER_LENGTH = 3;
const MAX_ANSWER_LENGTH = 10;

/** Max entry tier usable per difficulty (the pool is curated, so easy is broad). */
const MAX_TIER: Record<Difficulty, number> = {
  [Difficulty.EASY]: 1,
  [Difficulty.MEDIUM]: 2,
  [Difficulty.CHALLENGING]: 3,
  [Difficulty.HARD]: 3,
  [Difficulty.EXPERT]: 3,
};

/**
 * Normalize a Hebrew answer to the form stored in the grid and sent to clients:
 * no spaces, regular letterforms inside the word, final letterform at the end.
 */
export function normalizeHebrewAnswer(word: string): string {
  return applyHebrewFinalForms(word.replace(/\s+/g, ''));
}

interface HebrewAnswerEntry {
  answer: string; // normalized, final letterforms applied
  rank: number; // lower = more common (tier-weighted position)
  tier: number;
  clues: string[];
}

let cached: Map<string, HebrewAnswerEntry> | null = null;

function buildDatabase(): Map<string, HebrewAnswerEntry> {
  const entries = new Map<string, HebrewAnswerEntry>();

  HEBREW_ENTRIES.forEach((raw: RawHebrewEntry, index: number) => {
    const answer = normalizeHebrewAnswer(raw.a);

    if (!HEBREW_ANSWER_PATTERN.test(answer)) {
      console.warn(
        `⚠️  Hebrew clue database: skipping "${raw.a}" - answers must be a single Hebrew word, ` +
        `${MIN_ANSWER_LENGTH}-${MAX_ANSWER_LENGTH} letters`
      );
      return;
    }
    if (entries.has(answer)) {
      console.warn(`⚠️  Hebrew clue database: duplicate answer "${answer}" - keeping first entry`);
      return;
    }
    if (!raw.c || raw.c.length === 0) {
      console.warn(`⚠️  Hebrew clue database: "${answer}" has no clues - skipping`);
      return;
    }

    const tier = raw.t ?? 1;
    entries.set(answer, {
      answer,
      // Higher tiers rank as less common so the solver's word scorer
      // prefers everyday words, mirroring the English frequency ranks.
      rank: (tier - 1) * 10000 + index + 1,
      tier,
      clues: raw.c,
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

/** All Hebrew answers usable for the given difficulty. */
export function getWordPool(difficulty: Difficulty): string[] {
  const db = getDatabase();
  const maxTier = MAX_TIER[difficulty];
  const pool: string[] = [];
  for (const entry of db.values()) {
    if (entry.tier <= maxTier) pool.push(entry.answer);
  }
  return pool;
}

/** All clues for an answer, best-first. Returns [] for unknown answers. */
export function getCluesForWord(word: string): string[] {
  const db = getDatabase();
  const entry = db.get(normalizeHebrewAnswer(word));
  return entry ? entry.clues : [];
}

/** Rank of an answer (lower = more common); Infinity if unknown. */
export function getAnswerRank(word: string): number {
  const db = getDatabase();
  const entry = db.get(normalizeHebrewAnswer(word));
  return entry ? entry.rank : Infinity;
}
