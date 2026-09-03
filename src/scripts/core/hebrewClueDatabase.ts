/**
 * Hebrew clue database for the puzzle generator.
 * Vocab is the hand-curated list in hebrewClues.ts — used as written.
 */

import { Difficulty } from '../../types';
import { applyHebrewFinalForms } from './hebrewOrthography';
import { HEBREW_CLUES, RawHebrewEntry } from './hebrewClues';

const HEBREW_ENTRIES: RawHebrewEntry[] = HEBREW_CLUES;

/** Hebrew letters (includes final forms, which sit inside the א-ת range). */
const HEBREW_ANSWER_PATTERN = /^[\u05D0-\u05EA]{2,11}$/;

const MIN_ANSWER_LENGTH = 2;
const MAX_ANSWER_LENGTH = 11;

/** Max entry tier usable per difficulty (imported answers default to tier 1). */
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
  answer: string; // normalized, final letterforms applied (map key / grid)
  display: string; // original from hebrewClues.ts, spaces preserved for (3,4)
  rank: number; // lower = more common (tier-weighted position)
  tier: number;
  clues: string[];
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

function curatedClues(raw: RawHebrewEntry): string[] {
  return (raw.clues || []).map(c => c.trim()).filter(Boolean);
}

function buildDatabase(): Map<string, HebrewAnswerEntry> {
  const entries = new Map<string, HebrewAnswerEntry>();

  HEBREW_ENTRIES.forEach((raw: RawHebrewEntry, index: number) => {
    const answer = normalizeHebrewAnswer(raw.answer);

    if (!HEBREW_ANSWER_PATTERN.test(answer)) {
      console.warn(
        `⚠️  Hebrew clue database: skipping "${raw.answer}" - grid answers must be ` +
        `${MIN_ANSWER_LENGTH}-${MAX_ANSWER_LENGTH} Hebrew letters after spaces are removed`
      );
      return;
    }

    const clues = curatedClues(raw);
    const display = displayForm(raw.answer);

    if (entries.has(answer)) {
      const existing = entries.get(answer)!;
      for (const clue of clues) {
        if (!existing.clues.includes(clue)) existing.clues.push(clue);
      }
      existing.display = preferSpacedDisplay(existing.display, display);
      if (raw.difficulty !== undefined && raw.difficulty > existing.tier) {
        existing.tier = raw.difficulty;
      }
      return;
    }
    if (clues.length === 0) {
      console.warn(`⚠️  Hebrew clue database: "${answer}" has no clues - skipping`);
      return;
    }

    const tier = raw.difficulty ?? 1;
    const length = Array.from(answer).length;
    const lengthPenalty = length > 7 ? 140 : length < 4 ? 25 : 0;
    entries.set(answer, {
      answer,
      display,
      rank: Math.max(1, (tier - 1) * 8000 + 80 + lengthPenalty + (index % 120)),
      tier,
      clues
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

/** All clues for an answer. Easy-vocab definitions come first so pickClue uses them. */
export function getCluesForWord(word: string): string[] {
  const db = getDatabase();
  const entry = db.get(normalizeHebrewAnswer(word));
  if (!entry) return [];
  return entry.clues;
}


/** Rank of an answer (lower = more common); Infinity if unknown. */
export function getAnswerRank(word: string): number {
  const db = getDatabase();
  const entry = db.get(normalizeHebrewAnswer(word));
  return entry ? entry.rank : Infinity;
}
