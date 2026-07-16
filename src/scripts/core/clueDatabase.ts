/**
 * Curated clue database for the puzzle generator.
 *
 * Builds a pool of common English answers with high-quality clues from two sources:
 *  - synonyms.csv  (clue,answer,...)  - thesaurus pairs
 *  - train.csv     (id,clue,answer,...) - historical crossword clues
 *
 * Quality strategy:
 *  - Answers must be common words (frequency rank from wordlist-en-50k.txt).
 *  - Clues must be short, use only common words, and not contain the answer.
 *  - Crossword clues that appear repeatedly for the same answer are the most
 *    trustworthy ("NEED -> Requirement" appears dozens of times), so repetition
 *    is the primary quality signal for train.csv.
 *
 * Everything is loaded once and cached in module state.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Difficulty } from '../../types';

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

/** Answer word frequency rank ceiling per difficulty (lower rank = more common). */
const MAX_ANSWER_RANK: Record<Difficulty, number> = {
  [Difficulty.EASY]: 6000,
  [Difficulty.MEDIUM]: 12000,
  [Difficulty.CHALLENGING]: 20000,
  [Difficulty.HARD]: 20000,
  [Difficulty.EXPERT]: 20000,
};

/** Every word inside a clue must be at least this common. */
const MAX_CLUE_WORD_RANK = 20000;

/**
 * The frequency list is built from film subtitles, so spoken-language junk
 * ranks as "common". None of these make acceptable crossword answers.
 */
const ANSWER_BLACKLIST = new Set([
  'AAH', 'AHEM', 'AINT', 'ARGH', 'AWW', 'BLAH', 'BRB', 'CMON', 'DAMN', 'DOH',
  'DUH', 'DUNNO', 'EEK', 'ERR', 'GEE', 'GIMME', 'GONNA', 'GOTTA', 'HAHA',
  'HEE', 'HEH', 'HEHE', 'HEY', 'HMM', 'HUH', 'KINDA', 'LEMME', 'MMM', 'NAH',
  'OOH', 'OOPS', 'OUTTA', 'PHEW', 'PSST', 'SHH', 'SORTA', 'UGH', 'UHH',
  'UMM', 'WANNA', 'WHOA', 'WOO', 'WOW', 'YAY', 'YEAH', 'YEP', 'YER', 'YUP',
]);

const MIN_ANSWER_LENGTH = 3;
const MAX_ANSWER_LENGTH = 10;
const MIN_CLUE_LENGTH = 3;
const MAX_CLUE_LENGTH = 38;
const MAX_CLUE_WORDS = 5;

/** Crossword-jargon / fill-in-the-blank / meta clues we never want to show. */
const BAD_CLUE_PATTERN =
  /___|\.\.\.|\babbr|\bvar\b|\bfor short\b|["“”:;()[\]&/\\]|\d|\be\.g\b|\bslang\b|\binformal\b|\bprefix\b|\bsuffix\b|,|\bacross\b|\bdown\b|\banagram\b/i;

const ANSWER_PATTERN = /^[A-Z]{3,10}$/;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClueCandidate {
  clue: string;
  /** How often this exact clue appeared for this answer in train.csv (0 for synonyms). */
  repeatCount: number;
  /** Frequency rank of the rarest word inside the clue (lower = friendlier clue). */
  rarestWordRank: number;
  source: 'train' | 'synonyms';
}

export interface AnswerEntry {
  answer: string; // normalized, uppercase, letters only
  rank: number; // frequency rank of the answer word
  clues: ClueCandidate[]; // sorted best-first
}

interface Database {
  /** answer -> entry, only answers that have at least one good clue */
  entries: Map<string, AnswerEntry>;
  /** lowercase word -> frequency rank */
  wordRank: Map<string, number>;
}

let cached: Database | null = null;

// ---------------------------------------------------------------------------
// Loading helpers
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      if (j + 1 < line.length && line[j + 1] === '"') {
        current += '"';
        j++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

function loadWordRanks(): Map<string, number> {
  const filePath = path.join(__dirname, 'wordlist-en-50k.txt');
  const ranks = new Map<string, number>();
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  let rank = 0;
  for (const line of lines) {
    const word = line.split(' ')[0];
    if (!word || !/^[a-z]+$/.test(word)) continue;
    rank++;
    if (!ranks.has(word)) ranks.set(word, rank);
  }
  return ranks;
}

// ---------------------------------------------------------------------------
// Clue quality filters
// ---------------------------------------------------------------------------

function cleanClueText(clue: string): string {
  return clue.replace(/\s+/g, ' ').replace(/\.+$/, '').trim();
}

function clueWords(clue: string): string[] {
  const matches = clue.toLowerCase().match(/[a-z']+/g) || [];
  return matches.map(w => w.replace(/^'+|'+$/g, '')).filter(Boolean);
}

/** Reject clues that contain the answer or share a 4+ letter stem with it. */
function sharesStemWithAnswer(clue: string, answer: string): boolean {
  const a = answer.toLowerCase();
  for (const w of clueWords(clue)) {
    if (w === a) return true;
    if (w.length >= 4 && a.length >= 4 && w.slice(0, 4) === a.slice(0, 4)) return true;
  }
  return false;
}

function isGoodClue(clue: string, answer: string, wordRank: Map<string, number>): boolean {
  if (clue.length < MIN_CLUE_LENGTH || clue.length > MAX_CLUE_LENGTH) return false;
  if (BAD_CLUE_PATTERN.test(clue)) return false;
  if (sharesStemWithAnswer(clue, answer)) return false;

  // Reject proper-noun references ("Miss Miles", "Queen of Italy"): any
  // capitalized token after the first word is treated as a name.
  const rawTokens = clue.match(/[A-Za-z']+/g) || [];
  for (let i = 1; i < rawTokens.length; i++) {
    if (/^[A-Z]/.test(rawTokens[i])) return false;
  }

  const words = clueWords(clue);
  if (words.length === 0 || words.length > MAX_CLUE_WORDS) return false;

  for (const w of words) {
    // Single-letter tokens usually mean abbreviations ("B.A. and B.S")
    if (w.length === 1 && w !== 'a' && w !== 'i') return false;
    const rank = wordRank.get(w);
    if (rank === undefined || rank > MAX_CLUE_WORD_RANK) return false;
  }

  // Single-word clues that are rare words are usually names ("Ayesha" = SHE)
  if (words.length === 1 && (wordRank.get(words[0]) ?? Infinity) > 10000) return false;

  return true;
}

function rarestWordRank(clue: string, wordRank: Map<string, number>): number {
  let worst = 0;
  for (const w of clueWords(clue)) {
    worst = Math.max(worst, wordRank.get(w) ?? MAX_CLUE_WORD_RANK);
  }
  return worst;
}

function capitalize(clue: string): string {
  return clue.charAt(0).toUpperCase() + clue.slice(1);
}

// ---------------------------------------------------------------------------
// Database construction
// ---------------------------------------------------------------------------

function buildDatabase(): Database {
  const startTime = Date.now();
  console.log('📖 Building curated clue database...');

  const wordRank = loadWordRanks();

  // Candidate answers: common single words, 3-10 letters
  const maxRank = Math.max(...Object.values(MAX_ANSWER_RANK));
  const candidates = new Map<string, number>(); // ANSWER -> rank
  for (const [word, rank] of wordRank) {
    if (rank > maxRank) continue;
    const answer = word.toUpperCase();
    if (!ANSWER_PATTERN.test(answer) || ANSWER_BLACKLIST.has(answer)) continue;
    candidates.set(answer, rank);
  }

  // clue candidates per answer: clueKey -> candidate
  const clueMap = new Map<string, Map<string, ClueCandidate>>();

  const addClue = (answer: string, rawClue: string, source: 'train' | 'synonyms') => {
    const clue = cleanClueText(rawClue);
    if (!isGoodClue(clue, answer, wordRank)) return;

    let perAnswer = clueMap.get(answer);
    if (!perAnswer) {
      perAnswer = new Map();
      clueMap.set(answer, perAnswer);
    }
    const key = clue.toLowerCase();
    const existing = perAnswer.get(key);
    if (existing) {
      if (source === 'train') existing.repeatCount++;
    } else {
      perAnswer.set(key, {
        clue: capitalize(clue),
        repeatCount: source === 'train' ? 1 : 0,
        rarestWordRank: rarestWordRank(clue, wordRank),
        source,
      });
    }
  };

  // synonyms.csv: clue,answer,...
  const synonymsPath = path.join(__dirname, 'synonyms.csv');
  if (fs.existsSync(synonymsPath)) {
    const lines = fs.readFileSync(synonymsPath, 'utf-8').split('\n');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const parts = parseCSVLine(line);
      if (parts.length < 2) continue;
      const answer = parts[1].toUpperCase();
      if (!candidates.has(answer)) continue; // also drops multi-word answers
      addClue(answer, parts[0], 'synonyms');
    }
    console.log('   ✅ synonyms.csv processed');
  } else {
    console.warn('   ⚠️  synonyms.csv not found, skipping');
  }

  // train.csv: id,clue,answer,...
  const trainPath = path.join(__dirname, 'train.csv');
  if (fs.existsSync(trainPath)) {
    const lines = fs.readFileSync(trainPath, 'utf-8').split('\n');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const parts = parseCSVLine(line);
      if (parts.length < 3) continue;
      const answer = parts[2].toUpperCase();
      if (!candidates.has(answer)) continue;
      addClue(answer, parts[1], 'train');
    }
    console.log('   ✅ train.csv processed');
  } else {
    console.warn('   ⚠️  train.csv not found, skipping');
  }

  // Assemble entries with sorted clues.
  // One-off train.csv clues are dropped entirely: they are where cryptic clues
  // and data corruption live. A clue repeated across published crosswords is
  // trustworthy; so is a thesaurus pair.
  // Sort: repeated crossword clues first (most repeated first), then synonyms;
  // ties broken by how common the clue's own words are.
  const entries = new Map<string, AnswerEntry>();
  for (const [answer, perAnswer] of clueMap) {
    const clues = Array.from(perAnswer.values()).filter(
      c => c.source === 'synonyms' || c.repeatCount >= 2
    );
    if (clues.length === 0) continue;
    clues.sort((a, b) => {
      if (a.repeatCount !== b.repeatCount) return b.repeatCount - a.repeatCount;
      return a.rarestWordRank - b.rarestWordRank;
    });
    entries.set(answer, { answer, rank: candidates.get(answer)!, clues });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Clue database ready: ${entries.size.toLocaleString()} answers with quality clues (${elapsed}s)`);

  return { entries, wordRank };
}

function getDatabase(): Database {
  if (!cached) cached = buildDatabase();
  return cached;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * All answers usable for the given difficulty (uppercase, 3-10 letters,
 * each guaranteed to have at least one quality clue).
 */
export function getWordPool(difficulty: Difficulty): string[] {
  const db = getDatabase();
  const maxRank = MAX_ANSWER_RANK[difficulty];
  const pool: string[] = [];
  for (const entry of db.entries.values()) {
    if (entry.rank <= maxRank) pool.push(entry.answer);
  }
  return pool;
}

/**
 * All quality clues for an answer, sorted best-first.
 * Returns [] if the answer is not in the curated pool.
 */
export function getCluesForWord(word: string): string[] {
  const db = getDatabase();
  const entry = db.entries.get(word.replace(/\s+/g, '').toUpperCase());
  return entry ? entry.clues.map(c => c.clue) : [];
}

/** Frequency rank of an answer (lower = more common); Infinity if unknown. */
export function getAnswerRank(word: string): number {
  const db = getDatabase();
  const entry = db.entries.get(word.replace(/\s+/g, '').toUpperCase());
  return entry ? entry.rank : Infinity;
}
