import { CalendarDate, jerusalemHourKey } from './dailyClock';

export const FIVE_WORD_LENGTH = 5;
export const FIVE_GUESS_LIMIT = 5;
export const FIVE_ENTRY_COST = 100;
export const FIVE_HOUR_PRIZE_COINS = 300;
export const FIVE_LETTER_EPOCH: CalendarDate = { year: 2026, month: 1, day: 1 };
export const FIVE_LETTER_SEED_WORD = 'מגניב';

/** Regular Hebrew letters. Final forms are folded to these before a guess is checked. */
export const HEBREW_FIVE_LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';

export type LetterMark = 'correct' | 'present' | 'absent';
export type FiveLetterStatus = 'playing' | 'won' | 'lost';
export type FiveLetterRejectReason = 'wrong_length' | 'not_a_word' | 'round_closed';

export interface FiveLetterGuess {
  word: string;
  marks: LetterMark[];
}

export interface StoredFiveLetterRound {
  status: FiveLetterStatus;
  guesses: FiveLetterGuess[];
  elapsedSeconds: number | null;
  completionSeconds: number | null;
}

export interface FiveLetterCard {
  status: FiveLetterStatus;
  guessCount: number;
  bestTime: number | null;
  elapsedSeconds: number | null;
}

export interface FiveLetterCommunity {
  solvedCount: number;
  fastestSeconds: number | null;
}

export interface FiveLetterRoundView extends FiveLetterCommunity {
  roundId: string;
  date: string;
  endsAt: string;
  status: FiveLetterStatus;
  guesses: FiveLetterGuess[];
  elapsedSeconds: number;
  bestTime: number | null;
  /** True after this hour's 100-coin entry has been taken. */
  entryPaid: boolean;
  answer?: string;
}

const LETTERS = new Set(HEBREW_FIVE_LETTERS);
const FINAL_TO_REGULAR: Record<string, string> = {
  'ך': 'כ',
  'ם': 'מ',
  'ן': 'נ',
  'ף': 'פ',
  'ץ': 'צ',
};

export function emptyFiveLetterRound(): StoredFiveLetterRound {
  return {
    status: 'playing',
    guesses: [],
    elapsedSeconds: null,
    completionSeconds: null,
  };
}

/** Final letters become the regular letter. `שלומם` and `שלוממ` compare equal. */
export function normalizeFiveWord(word: string): string {
  return Array.from(word.normalize('NFC'), (letter) => FINAL_TO_REGULAR[letter] ?? letter).join('');
}

export function isFiveLetterWord(word: string): boolean {
  const letters = Array.from(normalizeFiveWord(word));
  return letters.length === FIVE_WORD_LENGTH && letters.every((letter) => LETTERS.has(letter));
}

/**
 * Right-place matches are taken first. Remaining copies are claimed from the
 * first letter of the guess toward the last. `null` when either side is not
 * five Hebrew letters.
 */
export function markGuess(guess: string, answer: string): LetterMark[] | null {
  if (!isFiveLetterWord(guess) || !isFiveLetterWord(answer)) return null;
  const guessed = Array.from(normalizeFiveWord(guess));
  const target = Array.from(normalizeFiveWord(answer));
  const marks: LetterMark[] = Array(FIVE_WORD_LENGTH).fill('absent');
  const remaining = new Map<string, number>();

  for (let i = 0; i < FIVE_WORD_LENGTH; i += 1) {
    if (guessed[i] === target[i]) {
      marks[i] = 'correct';
    } else {
      remaining.set(target[i], (remaining.get(target[i]) ?? 0) + 1);
    }
  }

  for (let i = 0; i < FIVE_WORD_LENGTH; i += 1) {
    if (marks[i] === 'correct') continue;
    const left = remaining.get(guessed[i]) ?? 0;
    if (left > 0) {
      marks[i] = 'present';
      remaining.set(guessed[i], left - 1);
    }
  }

  return marks;
}

/** Whole seconds, or `null` when the client did not send a usable timer value. */
export function wholeSeconds(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}

/**
 * Not five regular Hebrew letters → `wrong_length`, including letters that
 * are not Hebrew. A five-letter string missing from the Hebrew dictionary
 * is rejected later as `not_a_word`.
 */
export function classifyGuess(
  guess: unknown
): { ok: true; word: string } | { ok: false; reason: 'wrong_length' } {
  if (typeof guess !== 'string') return { ok: false, reason: 'wrong_length' };
  const word = normalizeFiveWord(guess);
  if (!isFiveLetterWord(word)) return { ok: false, reason: 'wrong_length' };
  return { ok: true, word };
}

/**
 * Midnights in Asia/Jerusalem from 2026-01-01 through `date`. That date is 0.
 * Calendar days, so a 23-hour or 25-hour Israel day still counts as one.
 */
export function fiveLetterDayNumber(date: CalendarDate): number {
  const today = Date.UTC(date.year, date.month - 1, date.day);
  const epoch = Date.UTC(
    FIVE_LETTER_EPOCH.year,
    FIVE_LETTER_EPOCH.month - 1,
    FIVE_LETTER_EPOCH.day
  );
  return Math.floor((today - epoch) / 86400000);
}

/**
 * Israel hours from 2026-01-01 00:00 through `date`. That hour is 0.
 * A 23-hour or 25-hour Israel day still uses the wall-clock hour, so a
 * skipped hour is a skipped index and the repeated hour shares one index.
 */
export function fiveLetterHourNumber(date: Date): number {
  const key = jerusalemHourKey(date);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/.exec(key);
  if (!match) return Number.NaN;
  const day = fiveLetterDayNumber({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  });
  return day * 24 + Number(match[4]);
}

export interface WordRow {
  word: string;
  _id: string;
}

/**
 * True when a word write turns `enabled` off. Deleting is handled separately.
 * Today's assigned row must stay enabled so guesses and the pinned answer agree.
 */
export function disablesFiveLetterWord(update: unknown): boolean {
  if (!update || typeof update !== 'object') return false;
  if (Array.isArray(update)) return update.some((stage) => disablesFiveLetterWord(stage));
  const record = update as Record<string, unknown>;
  if (record.enabled === false) return true;
  const unset = record.$unset;
  if (unset && typeof unset === 'object' && !Array.isArray(unset) && 'enabled' in unset) {
    return true;
  }
  for (const key of ['$set', '$setOnInsert']) {
    const inner = record[key];
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) continue;
    if ((inner as Record<string, unknown>).enabled === false) return true;
  }
  return false;
}

/** Enabled rows sorted by word (UTF-16 code units), then `_id`. */
export function pickFiveLetterWord<T extends WordRow>(words: readonly T[], dayNumber: number): T | null {
  if (words.length === 0 || !Number.isFinite(dayNumber)) return null;
  const sorted = [...words].sort((a, b) => {
    if (a.word < b.word) return -1;
    if (a.word > b.word) return 1;
    if (a._id < b._id) return -1;
    if (a._id > b._id) return 1;
    return 0;
  });
  const index = ((Math.floor(dayNumber) % sorted.length) + sorted.length) % sorted.length;
  return sorted[index];
}

export function applyGuess(
  round: StoredFiveLetterRound,
  word: string,
  answer: string,
  elapsedSeconds: number | null
): { ok: true; round: StoredFiveLetterRound; wonNow: boolean } | { ok: false; reason: 'round_closed' } {
  if (round.status !== 'playing' || round.guesses.length >= FIVE_GUESS_LIMIT) {
    return { ok: false, reason: 'round_closed' };
  }
  const marks = markGuess(word, answer);
  if (!marks) return { ok: false, reason: 'round_closed' };

  const guesses = [...round.guesses, { word, marks }];
  const wonNow = word === normalizeFiveWord(answer);
  const status: FiveLetterStatus = wonNow
    ? 'won'
    : guesses.length >= FIVE_GUESS_LIMIT
      ? 'lost'
      : 'playing';

  return {
    ok: true,
    wonNow,
    round: {
      status,
      guesses,
      elapsedSeconds: elapsedSeconds ?? round.elapsedSeconds,
      completionSeconds: wonNow && elapsedSeconds != null ? elapsedSeconds : round.completionSeconds,
    },
  };
}

/** A win counts once. A faster completion replaces the community best. A tie does not. */
export function recordSolve(
  stats: FiveLetterCommunity,
  completionSeconds: number | null
): FiveLetterCommunity {
  const fastestSeconds =
    completionSeconds == null
      ? stats.fastestSeconds
      : stats.fastestSeconds == null || completionSeconds < stats.fastestSeconds
        ? completionSeconds
        : stats.fastestSeconds;
  return {
    solvedCount: stats.solvedCount + 1,
    fastestSeconds,
  };
}

export function toFiveLetterCard(round: StoredFiveLetterRound | null): FiveLetterCard {
  if (!round) {
    return {
      status: 'playing',
      guessCount: 0,
      bestTime: null,
      elapsedSeconds: null,
    };
  }
  return {
    status: round.status,
    guessCount: round.guesses.length,
    bestTime: round.status === 'won' ? round.completionSeconds : null,
    elapsedSeconds: round.elapsedSeconds,
  };
}

export function toFiveLetterRoundView(input: {
  date: string;
  endsAt: string;
  answer: string;
  round: StoredFiveLetterRound | null;
  solvedCount: number;
  fastestSeconds: number | null;
  entryPaid?: boolean;
}): FiveLetterRoundView {
  const round = input.round ?? emptyFiveLetterRound();
  const view: FiveLetterRoundView = {
    roundId: input.date,
    date: input.date,
    endsAt: input.endsAt,
    status: round.status,
    guesses: round.guesses.map((guess) => ({ word: guess.word, marks: [...guess.marks] })),
    elapsedSeconds: round.elapsedSeconds ?? 0,
    bestTime: round.status === 'won' ? round.completionSeconds : null,
    solvedCount: input.solvedCount,
    fastestSeconds: input.fastestSeconds,
    entryPaid: input.entryPaid === true,
  };
  if (round.status === 'lost') {
    view.answer = normalizeFiveWord(input.answer);
  }
  return view;
}
