import fs from 'fs';
import path from 'path';
import { isFiveLetterWord, normalizeFiveWord } from '../utils/fiveLetters';

let words: Set<string> | null = null;
let sortedWords: string[] | null = null;

function cluesFile(): string | null {
  const candidates = [
    path.join(__dirname, '../scripts/core/hebrewClues.json'),
    path.join(__dirname, '../data/hebrewClues.json'),
    path.join(process.cwd(), 'src/scripts/core/hebrewClues.json'),
  ];
  return candidates.find((file) => fs.existsSync(file)) ?? null;
}

/**
 * Real five-letter answers from the Hebrew clue list, folded to regular letters.
 * Built once. Phrases (answers with a space) are not five-letter words.
 */
function lexicon(): Set<string> {
  if (words) return words;
  const file = cluesFile();
  const next = new Set<string>();
  if (!file) {
    console.error('Five letter lexicon file is missing');
    words = next;
    return next;
  }
  const entries = JSON.parse(fs.readFileSync(file, 'utf8')) as { answer?: unknown }[];
  for (const entry of entries) {
    if (typeof entry.answer !== 'string' || /\s/.test(entry.answer)) continue;
    const folded = normalizeFiveWord(entry.answer);
    if (isFiveLetterWord(folded)) next.add(folded);
  }
  words = next;
  return next;
}

export function isRealFiveLetterWord(normalized: string): boolean {
  return lexicon().has(normalized);
}

/** Lexicon words in UTF-16 order. Stable, so an hour index always picks the same word. */
export function sortedFiveLetterWords(): readonly string[] {
  if (!sortedWords) {
    sortedWords = [...lexicon()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  return sortedWords;
}
