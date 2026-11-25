import { fiveLetterDayNumber, normalizeFiveWord } from './fiveLetters';
import type { CalendarDate } from './dailyClock';

export const HIVE_LETTER_COUNT = 7;
export const HIVE_MIN_LENGTH = 4;
export const HIVE_MAX_LENGTH = 8;
export const HIVE_MIN_ANSWERS = 18;
export const HIVE_MAX_ANSWERS = 36;
export const HIVE_SHORT_SHARE = 0.7;
export const HIVE_CENTER_SHARE = 0.5;
export const HIVE_PANGRAM_BONUS = 7;

/** Regular Hebrew letters. Final forms are folded before this set is checked. */
export const HIVE_LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';

export const HIVE_RANKS = ['beginner', 'moving', 'nice', 'great', 'genius'] as const;
export type HiveRank = (typeof HIVE_RANKS)[number];

export type HiveRejectReason =
  | 'too_short'
  | 'bad_letters'
  | 'missing_center'
  | 'not_a_word'
  | 'already_found'
  | 'day_closed';

export interface QualifiedHive {
  id: string;
  center: string;
  outer: string[];
  answers: string[];
  maxScore: number;
}

export interface HivePuzzle {
  center: string;
  hiveMask: number;
  answers: ReadonlySet<string>;
}

const LETTER_INDEX = new Map(
  Array.from(HIVE_LETTERS, (letter, index) => [letter, index])
);

const RANK_STEPS: { rank: HiveRank; share: number }[] = [
  { rank: 'genius', share: 0.7 },
  { rank: 'great', share: 0.45 },
  { rank: 'nice', share: 0.25 },
  { rank: 'moving', share: 0.1 },
];

export function hiveDayNumber(date: CalendarDate): number {
  return fiveLetterDayNumber(date);
}

export function popcount(mask: number): number {
  let count = 0;
  let bits = mask;
  while (bits) {
    count += bits & 1;
    bits >>>= 1;
  }
  return count;
}

/** Bit mask of regular Hebrew letters. `null` when any character is not a letter. */
export function letterMask(word: string): number | null {
  let mask = 0;
  for (const letter of word) {
    const index = LETTER_INDEX.get(letter);
    if (index == null) return null;
    mask |= 1 << index;
  }
  return mask;
}

export function maskLetters(mask: number): string[] {
  const letters: string[] = [];
  for (let index = 0; index < HIVE_LETTERS.length; index += 1) {
    if ((mask & (1 << index)) !== 0) letters.push(HIVE_LETTERS[index]);
  }
  return letters;
}

export function hiveMaskOf(center: string, outer: readonly string[]): number {
  const mask = letterMask(center + outer.join(''));
  if (mask == null || popcount(mask) !== HIVE_LETTER_COUNT) {
    throw new Error('Invalid hive letters');
  }
  return mask;
}

/**
 * 4 letters score 1. Each extra letter scores 1.
 * A word that uses every hive letter scores 7 more.
 */
export function hiveWordScore(word: string, hiveMask: number): number {
  const length = Array.from(word).length;
  const score = length - (HIVE_MIN_LENGTH - 1);
  const used = letterMask(word);
  if (used != null && used === hiveMask) return score + HIVE_PANGRAM_BONUS;
  return score;
}

export function hiveRank(score: number, maxScore: number): HiveRank {
  if (maxScore <= 0 || score <= 0) return 'beginner';
  const share = score / maxScore;
  for (const step of RANK_STEPS) {
    if (share >= step.share) return step.rank;
  }
  return 'beginner';
}

function compareWord(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * A 7-letter hive is easy-to-medium when it has 18–36 answers, at least 70%
 * are 4–5 letters, at least one word is 6 or longer, and the center letter
 * sits in at least half of the answers. The center is the hive letter that
 * appears in the most answers. Ties take the earlier letter.
 */
export interface PreparedWord {
  word: string;
  mask: number;
  length: number;
}

export function qualifyPrepared(words: readonly PreparedWord[], hiveMask: number): QualifiedHive | null {
  if (popcount(hiveMask) !== HIVE_LETTER_COUNT) return null;
  const answers: PreparedWord[] = [];
  const seen = new Set<string>();
  let short = 0;
  let long = 0;
  const centerHits = new Array<number>(HIVE_LETTERS.length).fill(0);

  for (const word of words) {
    if (seen.has(word.word) || (word.mask & hiveMask) !== word.mask) continue;
    if (word.length < HIVE_MIN_LENGTH || word.length > HIVE_MAX_LENGTH) continue;
    seen.add(word.word);
    answers.push(word);
    if (word.length <= 5) short += 1;
    if (word.length >= 6) long += 1;
    for (let index = 0; index < HIVE_LETTERS.length; index += 1) {
      const bit = 1 << index;
      if ((hiveMask & bit) !== 0 && (word.mask & bit) !== 0) centerHits[index] += 1;
    }
  }

  const total = answers.length;
  if (total < HIVE_MIN_ANSWERS || total > HIVE_MAX_ANSWERS) return null;
  if (short / total < HIVE_SHORT_SHARE) return null;
  if (long < 1) return null;

  let bestHits = -1;
  let centerIndex = -1;
  for (let index = 0; index < HIVE_LETTERS.length; index += 1) {
    if ((hiveMask & (1 << index)) === 0) continue;
    if (centerHits[index] > bestHits) {
      bestHits = centerHits[index];
      centerIndex = index;
    }
  }
  if (centerIndex < 0 || bestHits / total < HIVE_CENTER_SHARE) return null;

  const center = HIVE_LETTERS[centerIndex];
  const outer = maskLetters(hiveMask).filter((letter) => letter !== center);
  const sorted = answers.map((word) => word.word).sort(compareWord);
  const maxScore = answers.reduce((sum, word) => sum + hiveWordScore(word.word, hiveMask), 0);
  return {
    id: `${center}${outer.join('')}`,
    center,
    outer,
    answers: sorted,
    maxScore,
  };
}

export function qualifyHive(words: readonly string[], hiveMask: number): QualifiedHive | null {
  const prepared: PreparedWord[] = [];
  for (const word of words) {
    const mask = letterMask(word);
    if (mask == null) continue;
    prepared.push({ word, mask, length: Array.from(word).length });
  }
  return qualifyPrepared(prepared, hiveMask);
}

/** The stored hive wins. A missing pin falls through to the hive generated for that day. */
export function keepPinnedHive<T>(pinned: T | null, generated: T | null): T | null {
  return pinned ?? generated;
}

export function pickHive<T>(hives: readonly T[], dayNumber: number): T | null {
  if (hives.length === 0 || !Number.isFinite(dayNumber)) return null;
  const index = ((Math.floor(dayNumber) % hives.length) + hives.length) % hives.length;
  return hives[index];
}

export function classifyHiveGuess(
  guess: unknown,
  puzzle: HivePuzzle,
  found: ReadonlySet<string>
): { ok: true; word: string; score: number } | { ok: false; reason: HiveRejectReason } {
  if (puzzle.answers.size > 0 && found.size >= puzzle.answers.size) {
    return { ok: false, reason: 'day_closed' };
  }
  if (typeof guess !== 'string') return { ok: false, reason: 'too_short' };
  const word = normalizeFiveWord(guess.trim());
  if (Array.from(word).length < HIVE_MIN_LENGTH) return { ok: false, reason: 'too_short' };
  const mask = letterMask(word);
  if (mask == null || (mask & puzzle.hiveMask) !== mask) {
    return { ok: false, reason: 'bad_letters' };
  }
  const centerBit = LETTER_INDEX.get(puzzle.center);
  if (centerBit == null || (mask & (1 << centerBit)) === 0) {
    return { ok: false, reason: 'missing_center' };
  }
  if (found.has(word)) return { ok: false, reason: 'already_found' };
  if (!puzzle.answers.has(word)) return { ok: false, reason: 'not_a_word' };
  return { ok: true, word, score: hiveWordScore(word, puzzle.hiveMask) };
}
