/**
 * Curated Hebrew clue database for the puzzle generator.
 *
 * Sources (first wins on clue order, then quality-sorted):
 *  - hebrewCluesCrafted.ts  short תשחץ-style definitions
 *  - hebrewClues.ts         core vocabulary
 *  - hebrewCluesMore.ts     extra fill + culture
 */

import { Difficulty } from '../../types';
import { applyHebrewFinalForms } from './hebrewOrthography';
import { HEBREW_ENTRIES as BASE_ENTRIES, RawHebrewEntry } from './hebrewClues';
import { HEBREW_ENTRIES_CRAFTED } from './hebrewCluesCrafted';
import { HEBREW_ENTRIES_MORE } from './hebrewCluesMore';

const HEBREW_ENTRIES: RawHebrewEntry[] = [
  ...HEBREW_ENTRIES_CRAFTED,
  ...BASE_ENTRIES,
  ...HEBREW_ENTRIES_MORE,
];

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

function hebrewLettersOnly(text: string): string {
  return Array.from(text).filter(ch => ch >= '\u05D0' && ch <= '\u05EA').join('');
}

function isUsableClue(clue: string, answer: string): boolean {
  if (!clue || !clue.trim()) return false;
  const tokens = clue.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const letters = hebrewLettersOnly(token);
    if (letters && normalizeHebrewAnswer(letters) === answer) return false;
  }
  return true;
}

/** Higher = more like a real תשחץ cell clue. */
function scoreClue(clue: string): number {
  const words = clue.trim().split(/\s+/).filter(Boolean);
  const len = clue.length;
  let score = 10;
  if (len >= 6 && len <= 22) score += 8;
  else if (len <= 28) score += 4;
  else if (len > 32) score -= 10;
  if (words.length >= 2 && words.length <= 5) score += 5;
  else if (words.length > 6) score -= 6;
  if (/גם| או |\/|\?/.test(clue)) score += 6;
  if (/פתגם|שחמט|מקרא|בירת|הפך|תרתי|סלנג/.test(clue)) score += 5;
  if (/^יש ב/.test(clue) || /רהיט/.test(clue) || /מקום מגורים/.test(clue)) score -= 8;
  if (/למשל$/.test(clue.trim())) score -= 2;
  return score;
}

function sortClues(clues: string[]): string[] {
  return [...clues].sort((a, b) => scoreClue(b) - scoreClue(a));
}

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

    const clues = (raw.c || []).filter(c => isUsableClue(c, answer));

    if (entries.has(answer)) {
      const existing = entries.get(answer)!;
      for (const clue of clues) {
        if (!existing.clues.includes(clue)) existing.clues.push(clue);
      }
      existing.clues = sortClues(existing.clues);
      if (raw.t !== undefined && raw.t > existing.tier) {
        existing.tier = raw.t;
      }
      return;
    }
    if (clues.length === 0) {
      console.warn(`⚠️  Hebrew clue database: "${answer}" has no clues - skipping`);
      return;
    }

    const tier = raw.t ?? 1;
    const length = Array.from(answer).length;
    // Flatten insertion order so late culture/GK words can actually fill grids.
    // Jitter in the solver then picks among a mixed, interesting pool.
    const lengthPenalty = length > 7 ? 140 : length < 4 ? 25 : 0;
    entries.set(answer, {
      answer,
      rank: (tier - 1) * 8000 + 80 + lengthPenalty + (index % 120),
      tier,
      clues: sortClues(clues),
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
