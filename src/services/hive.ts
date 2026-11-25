import { Types } from 'mongoose';
import { HiveDay, IHiveDay } from '../models/HiveDay';
import { HiveRound, IHiveRound } from '../models/HiveRound';
import { User } from '../models/User';
import {
  dailyGameDateString,
  jerusalemCalendarDate,
  nextJerusalemMidnight,
} from '../utils/dailyClock';
import {
  classifyHiveGuess,
  hiveDayNumber,
  hiveMaskOf,
  hiveRank,
  keepPinnedHive,
  pickHive,
  type HiveRank,
  type QualifiedHive,
} from '../utils/hive';
import { wholeSeconds } from '../utils/fiveLetters';
import { playableWords, sortedHives } from './hiveLexicon';

export interface HiveCard {
  date: string;
  score: number;
  wordCount: number;
  rank: HiveRank;
  totalWords: number;
}

export interface HiveRoundView {
  date: string;
  endsAt: string;
  center: string;
  outer: string[];
  found: string[];
  score: number;
  maxScore: number;
  rank: HiveRank;
  totalWords: number;
  elapsedSeconds: number;
  won: boolean;
}

interface DayAssignment {
  date: string;
  endsAt: string;
  center: string;
  outer: string[];
  answers: string[];
  maxScore: number;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error != null && (error as { code?: number }).code === 11000;
}

function bodyOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function fromStored(endsAt: string, day: Pick<IHiveDay, 'date' | 'center' | 'outer' | 'answers' | 'maxScore'>): DayAssignment {
  return {
    date: day.date,
    endsAt,
    center: day.center,
    outer: day.outer,
    answers: day.answers,
    maxScore: day.maxScore,
  };
}

function storedHive(day: Pick<IHiveDay, 'center' | 'outer' | 'answers' | 'maxScore'>): QualifiedHive {
  return {
    id: `${day.center}${day.outer.join('')}`,
    center: day.center,
    outer: day.outer,
    answers: day.answers,
    maxScore: day.maxScore,
  };
}

/** Pins this date's hive on first use so a later lexicon change does not swap it. */
async function ensureDay(now: Date): Promise<DayAssignment> {
  const date = dailyGameDateString(now);
  const endsAt = nextJerusalemMidnight(now).toISOString();
  const existing = await HiveDay.findOne({ date }).lean();
  const generated = pickHive(sortedHives(), hiveDayNumber(jerusalemCalendarDate(now)));
  const hive = keepPinnedHive(existing ? storedHive(existing) : null, generated);
  if (!hive) throw new Error('No hive available');
  if (existing) return fromStored(endsAt, existing);

  try {
    const created = await HiveDay.findOneAndUpdate(
      { date },
      {
        $setOnInsert: {
          date,
          center: hive.center,
          outer: hive.outer,
          answers: hive.answers,
          maxScore: hive.maxScore,
        },
      },
      { upsert: true, new: true }
    ).lean();
    if (!created) throw new Error('No hive available');
    return fromStored(endsAt, created);
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const again = await HiveDay.findOne({ date }).lean();
    if (!again) throw error;
    return fromStored(endsAt, again);
  }
}

/** The pinned letters stay. The words a player may enter come from the dictionary. */
function opened(day: DayAssignment): DayAssignment {
  const playable = playableWords(day.center, day.outer);
  if (playable.answers.length === 0) return day;
  const answers = [...new Set([...playable.answers, ...day.answers])].sort((left, right) => (
    left < right ? -1 : left > right ? 1 : 0
  ));
  return {
    ...day,
    answers,
    maxScore: playable.maxScore,
  };
}

function viewFor(
  day: DayAssignment,
  found: string[],
  score: number,
  elapsedSeconds: number,
  won: boolean,
): HiveRoundView {
  return {
    date: day.date,
    endsAt: day.endsAt,
    center: day.center,
    outer: day.outer,
    found,
    score,
    maxScore: day.maxScore,
    rank: hiveRank(score, day.maxScore),
    totalWords: day.answers.length,
    elapsedSeconds,
    won,
  };
}

function clockOf(
  foundCount: number,
  totalWords: number,
  elapsedSeconds: number | null | undefined,
  completionSeconds: number | null | undefined,
): { elapsedSeconds: number; won: boolean } {
  const won = totalWords > 0 && foundCount >= totalWords;
  const elapsed = won
    ? (completionSeconds ?? elapsedSeconds ?? 0)
    : (elapsedSeconds ?? 0);
  return { elapsedSeconds: Math.max(0, Math.floor(elapsed)), won };
}

function cardFor(day: DayAssignment, found: string[], score: number): HiveCard {
  return {
    date: day.date,
    score,
    wordCount: found.length,
    rank: hiveRank(score, day.maxScore),
    totalWords: day.answers.length,
  };
}

async function requireUser(firebaseUid: string) {
  return User.findOne({ firebaseUid }).select('_id');
}

async function playerRound(userId: Types.ObjectId, date: string): Promise<IHiveRound | null> {
  return HiveRound.findOne({ userId, date });
}

export async function getHiveCardForUser(firebaseUid: string, now = new Date()) {
  const user = await requireUser(firebaseUid);
  if (!user) return { status: 404 as const, body: { error: 'User not found' } };

  const day = opened(await ensureDay(now));
  const round = await playerRound(user._id, day.date);
  return {
    status: 200 as const,
    body: cardFor(day, round?.found ?? [], round?.score ?? 0),
  };
}

export async function getHiveTodayForUser(firebaseUid: string, now = new Date()) {
  const user = await requireUser(firebaseUid);
  if (!user) return { status: 404 as const, body: { error: 'User not found' } };

  const day = opened(await ensureDay(now));
  const round = await playerRound(user._id, day.date);
  const clock = clockOf(round?.found.length ?? 0, day.answers.length, round?.elapsedSeconds, round?.completionSeconds);
  return {
    status: 200 as const,
    body: viewFor(day, round?.found ?? [], round?.score ?? 0, clock.elapsedSeconds, clock.won),
  };
}

async function storeFound(
  userId: Types.ObjectId,
  date: string,
  word: string,
  scoreGain: number,
  answerCount: number,
  elapsed: number | null,
): Promise<{ found: string[]; score: number; elapsedSeconds: number; won: boolean } | 'closed' | 'duplicate'> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await HiveRound.findOne({ userId, date });
    const found = current?.found ?? [];
    if (found.length >= answerCount) return 'closed';
    if (found.includes(word)) return 'duplicate';
    const nextFound = [...found, word].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    const nextScore = (current?.score ?? 0) + scoreGain;
    const elapsedSeconds = elapsed ?? current?.elapsedSeconds ?? 0;
    const won = nextFound.length >= answerCount;

    if (!current) {
      try {
        await HiveRound.create({
          userId,
          date,
          found: nextFound,
          score: nextScore,
          elapsedSeconds,
          completionSeconds: won ? elapsedSeconds : null,
        });
        return { found: nextFound, score: nextScore, elapsedSeconds, won };
      } catch (error) {
        if (isDuplicateKey(error)) continue;
        throw error;
      }
    }

    const saved = await HiveRound.updateOne(
      {
        _id: current._id,
        $expr: { $eq: [{ $size: '$found' }, found.length] },
      },
      {
        $set: {
          found: nextFound,
          score: nextScore,
          elapsedSeconds,
          ...(won ? { completionSeconds: elapsedSeconds } : {}),
        },
      }
    );
    if (saved.matchedCount === 1) return { found: nextFound, score: nextScore, elapsedSeconds, won };
  }
  throw new Error('Failed to store hive guess');
}

export async function submitHiveGuess(firebaseUid: string, body: unknown, now = new Date()) {
  const user = await requireUser(firebaseUid);
  if (!user) return { status: 404 as const, body: { error: 'User not found' } };

  const day = opened(await ensureDay(now));
  const round = await playerRound(user._id, day.date);
  const found = new Set(round?.found ?? []);
  const elapsed = wholeSeconds(bodyOf(body)?.elapsedSeconds);
  const classified = classifyHiveGuess(
    bodyOf(body)?.word,
    {
      center: day.center,
      hiveMask: hiveMaskOf(day.center, day.outer),
      answers: new Set(day.answers),
    },
    found
  );
  if (!classified.ok) {
    return { status: 200 as const, body: { valid: false, reason: classified.reason } };
  }

  const stored = await storeFound(
    user._id,
    day.date,
    classified.word,
    classified.score,
    day.answers.length,
    elapsed,
  );
  if (stored === 'closed') {
    return { status: 200 as const, body: { valid: false, reason: 'day_closed' } };
  }
  if (stored === 'duplicate') {
    return { status: 200 as const, body: { valid: false, reason: 'already_found' } };
  }
  return {
    status: 200 as const,
    body: {
      valid: true,
      round: viewFor(day, stored.found, stored.score, stored.elapsedSeconds, stored.won),
    },
  };
}

export async function saveHiveElapsedForUser(firebaseUid: string, body: unknown, now = new Date()) {
  const seconds = wholeSeconds(bodyOf(body)?.elapsedSeconds);
  if (seconds == null) return { status: 200 as const, body: { ok: true } };

  const user = await requireUser(firebaseUid);
  if (!user) return { status: 404 as const, body: { error: 'User not found' } };

  const day = opened(await ensureDay(now));
  const round = await playerRound(user._id, day.date);
  if (round && day.answers.length > 0 && round.found.length >= day.answers.length) {
    return { status: 200 as const, body: { ok: true } };
  }

  await HiveRound.updateOne(
    { userId: user._id, date: day.date },
    {
      $set: { elapsedSeconds: seconds },
      $setOnInsert: { found: [], score: 0, completionSeconds: null },
    },
    { upsert: true },
  );
  return { status: 200 as const, body: { ok: true } };
}
