import fs from 'fs';
import path from 'path';
import { normalizeFiveWord } from '../utils/fiveLetters';
import {
  HIVE_LETTERS,
  HIVE_MAX_LENGTH,
  HIVE_MIN_LENGTH,
  letterMask,
  popcount,
  qualifyPrepared,
  type PreparedWord,
  type QualifiedHive,
} from '../utils/hive';

const LETTERS = new Set(HIVE_LETTERS);

let cached: QualifiedHive[] | null = null;

interface ClueEntry {
  answer?: unknown;
  fillScore?: unknown;
}

function cluesFile(): string | null {
  const candidates = [
    path.join(__dirname, '../scripts/core/hebrewClues.json'),
    path.join(__dirname, '../data/hebrewClues.json'),
    path.join(process.cwd(), 'src/scripts/core/hebrewClues.json'),
  ];
  return candidates.find((file) => fs.existsSync(file)) ?? null;
}

function isEligible(entry: ClueEntry): string | null {
  if (typeof entry.answer !== 'string' || /\s/.test(entry.answer)) return null;
  if (typeof entry.fillScore !== 'number' || entry.fillScore < 3) return null;
  const word = normalizeFiveWord(entry.answer);
  const letters = Array.from(word);
  if (letters.length < HIVE_MIN_LENGTH || letters.length > HIVE_MAX_LENGTH) return null;
  if (!letters.every((letter) => LETTERS.has(letter))) return null;
  const mask = letterMask(word);
  if (mask == null || popcount(mask) > 7) return null;
  return word;
}

/**
 * Easy-to-medium hives from crossword answers.
 * A word with 7 unique letters is a hive. A word with 6 unique letters becomes
 * a hive by adding one other letter. Sorted by id so a day index stays put.
 */
export function buildHives(entries: readonly ClueEntry[]): QualifiedHive[] {
  const words: { word: string; mask: number; bits: number }[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const word = isEligible(entry);
    if (!word || seen.has(word)) continue;
    const mask = letterMask(word);
    if (mask == null) continue;
    seen.add(word);
    words.push({ word, mask, bits: popcount(mask) });
  }

  const seeds = new Set<number>();
  for (const word of words) {
    if (word.bits === 7) seeds.add(word.mask);
    if (word.bits !== 6) continue;
    for (let index = 0; index < HIVE_LETTERS.length; index += 1) {
      const bit = 1 << index;
      if ((word.mask & bit) === 0) seeds.add(word.mask | bit);
    }
  }

  const list: PreparedWord[] = words.map((word) => ({
    word: word.word,
    mask: word.mask,
    length: Array.from(word.word).length,
  }));
  const hives: QualifiedHive[] = [];
  for (const mask of seeds) {
    const hive = qualifyPrepared(list, mask);
    if (hive) hives.push(hive);
  }
  hives.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  return hives;
}

/** Built once. Today's row is pinned separately, so a later edit does not change the live hive. */
export function sortedHives(): readonly QualifiedHive[] {
  if (cached) return cached;
  const file = cluesFile();
  if (!file) {
    console.error('Hive lexicon file is missing');
    cached = [];
    return cached;
  }
  const entries = JSON.parse(fs.readFileSync(file, 'utf8')) as ClueEntry[];
  cached = buildHives(entries);
  if (cached.length === 0) console.error('Hive lexicon produced no puzzles');
  return cached;
}
