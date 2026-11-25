import fs from 'fs';
import path from 'path';
import { normalizeFiveWord } from '../utils/fiveLetters';
import {
  HIVE_LETTERS,
  HIVE_MAX_LENGTH,
  HIVE_MIN_LENGTH,
  hiveWordScore,
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

let dictionary: PreparedWord[] | null = null;
const playableCache = new Map<string, { answers: string[]; maxScore: number }>();

function dictionaryFile(): string | null {
  const candidates = [
    path.join(__dirname, '../scripts/core/hebrewFiveLetterWords.txt'),
    path.join(__dirname, '../data/hebrewFiveLetterWords.txt'),
    path.join(process.cwd(), 'src/scripts/core/hebrewFiveLetterWords.txt'),
  ];
  return candidates.find((file) => fs.existsSync(file)) ?? null;
}

function rememberWord(words: Map<string, PreparedWord>, word: string): void {
  if (words.has(word)) return;
  const letters = Array.from(word);
  if (letters.length < HIVE_MIN_LENGTH || letters.length > HIVE_MAX_LENGTH) return;
  if (!letters.every((letter) => LETTERS.has(letter))) return;
  const mask = letterMask(word);
  if (mask == null || popcount(mask) > 7) return;
  words.set(word, { word, mask, length: letters.length });
}

/** Every real hive word: the Hebrew dictionary plus crossword answers of 4–8 letters. */
function dictionaryWords(): readonly PreparedWord[] {
  if (dictionary) return dictionary;
  const words = new Map<string, PreparedWord>();
  const list = dictionaryFile();
  if (list) {
    for (const line of fs.readFileSync(list, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      rememberWord(words, normalizeFiveWord(trimmed));
    }
  } else {
    console.error('Hive dictionary file is missing');
  }
  const clues = cluesFile();
  if (clues) {
    const entries = JSON.parse(fs.readFileSync(clues, 'utf8')) as ClueEntry[];
    for (const entry of entries) {
      if (typeof entry.answer !== 'string' || /\s/.test(entry.answer)) continue;
      rememberWord(words, normalizeFiveWord(entry.answer));
    }
  }
  dictionary = [...words.values()];
  return dictionary;
}

/**
 * Words a player may enter for these letters. Wider than the common list
 * that wins the day: any dictionary or crossword word that uses the center.
 */
export function playableWords(
  center: string,
  outer: readonly string[]
): { answers: string[]; maxScore: number } {
  const key = `${center}:${[...outer].sort().join('')}`;
  const cachedWords = playableCache.get(key);
  if (cachedWords) return cachedWords;
  const hiveMask = letterMask(center + outer.join(''));
  const centerMask = letterMask(center);
  const answers: string[] = [];
  if (hiveMask != null && centerMask != null) {
    for (const word of dictionaryWords()) {
      if ((word.mask & hiveMask) !== word.mask) continue;
      if ((word.mask & centerMask) !== centerMask) continue;
      answers.push(word.word);
    }
  }
  answers.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const maxScore = hiveMask == null
    ? 0
    : answers.reduce((sum, word) => sum + hiveWordScore(word, hiveMask), 0);
  const result = { answers, maxScore };
  playableCache.set(key, result);
  return result;
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
