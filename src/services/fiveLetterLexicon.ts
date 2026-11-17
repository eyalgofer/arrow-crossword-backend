import fs from 'fs';
import path from 'path';
import { isFiveLetterWord, normalizeFiveWord } from '../utils/fiveLetters';

let clueWords: Set<string> | null = null;
let dictionary: Set<string> | null = null;
let sortedWords: string[] | null = null;

/** Clitics that attach to a real word: ו/ה/ב/כ/ל/מ/ש, including the usual pairs. */
const PREFIXES = [
  'וה', 'וב', 'וכ', 'ול', 'ומ', 'וש',
  'שה', 'שב', 'שכ', 'של', 'שמ',
  'בה', 'כה', 'לה', 'מה',
  'ו', 'ה', 'ב', 'כ', 'ל', 'מ', 'ש',
];

function cluesFile(): string | null {
  const candidates = [
    path.join(__dirname, '../scripts/core/hebrewClues.json'),
    path.join(__dirname, '../data/hebrewClues.json'),
    path.join(process.cwd(), 'src/scripts/core/hebrewClues.json'),
  ];
  return candidates.find((file) => fs.existsSync(file)) ?? null;
}

function dictionaryFile(): string | null {
  const candidates = [
    path.join(__dirname, '../scripts/core/hebrewFiveLetterWords.txt'),
    path.join(__dirname, '../data/hebrewFiveLetterWords.txt'),
    path.join(process.cwd(), 'src/scripts/core/hebrewFiveLetterWords.txt'),
  ];
  return candidates.find((file) => fs.existsSync(file)) ?? null;
}

/**
 * Five-letter answers from the Hebrew clue list, folded to regular letters.
 * Built once. Phrases (answers with a space) are not five-letter words.
 * This list chooses the hour's word. It is not the guess dictionary.
 */
function clues(): Set<string> {
  if (clueWords) return clueWords;
  const file = cluesFile();
  const next = new Set<string>();
  if (!file) {
    console.error('Five letter lexicon file is missing');
    clueWords = next;
    return next;
  }
  const entries = JSON.parse(fs.readFileSync(file, 'utf8')) as { answer?: unknown }[];
  for (const entry of entries) {
    if (typeof entry.answer !== 'string' || /\s/.test(entry.answer)) continue;
    const folded = normalizeFiveWord(entry.answer);
    if (isFiveLetterWord(folded)) next.add(folded);
  }
  clueWords = next;
  return next;
}

/** Hebrew dictionary words of 3–5 letters, folded. Built once. */
function words(): Set<string> {
  if (dictionary) return dictionary;
  const file = dictionaryFile();
  const next = new Set<string>();
  if (!file) {
    console.error('Five letter dictionary file is missing');
    dictionary = next;
    return next;
  }
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    next.add(normalizeFiveWord(trimmed));
  }
  dictionary = next;
  return next;
}

/**
 * True when the guess is a dictionary word, a clitic plus a dictionary word
 * (`בבוקר`, `והבית`), or one of this game's five-letter answers.
 */
export function isRealFiveLetterWord(normalized: string): boolean {
  const word = normalizeFiveWord(normalized);
  if (!isFiveLetterWord(word)) return false;
  if (words().has(word) || clues().has(word)) return true;
  for (const prefix of PREFIXES) {
    if (!word.startsWith(prefix)) continue;
    if (words().has(word.slice(prefix.length))) return true;
  }
  return false;
}

/** Clue-list answers in UTF-16 order. Stable, so an hour index always picks the same word. */
export function sortedFiveLetterWords(): readonly string[] {
  if (!sortedWords) {
    sortedWords = [...clues()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  return sortedWords;
}
