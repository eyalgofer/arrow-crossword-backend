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
import { sortedHives } from './hiveLexicon';

export interface HiveCard {
  date: string;
  score: number;
  wordCount: number;
  rank: HiveRank;
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

function viewFor(day: DayAssignment, found: string[], score: number): HiveRoundView {
  return {
    date: day.date,
    endsAt: day.endsAt,
    center: day.center,
    outer: day.outer,
    found,
    score,
    maxScore: day.maxScore,
    rank: hiveRank(score, day.maxScore),
  };
}

function cardFor(day: DayAssignment, found: string[], score: number): HiveCard {
  return {
    date: day.date,
    score,
    wordCount: found.length,
    rank: hiveRank(score, day.maxScore),
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

  const day = await ensureDay(now);
  const round = await playerRound(user._id, day.date);
  return {
    status: 200 as const,
    body: cardFor(day, round?.found ?? [], round?.score ?? 0),
  };
}

export async function getHiveTodayForUser(firebaseUid: string, now = new Date()) {
  const user = await requireUser(firebaseUid);
  if (!user) return { status: 404 as const, body: { error: 'User not found' } };

  const day = await ensureDay(now);
  const round = await playerRound(user._id, day.date);
  return {
    status: 200 as const,
    body: viewFor(day, round?.found ?? [], round?.score ?? 0),
  };
}

async function storeFound(
  userId: Types.ObjectId,
  date: string,
  word: string,
  scoreGain: number,
  answerCount: number
): Promise<{ found: string[]; score: number } | 'closed' | 'duplicate'> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await HiveRound.findOne({ userId, date });
    const found = current?.found ?? [];
    if (found.length >= answerCount) return 'closed';
    if (found.includes(word)) return 'duplicate';
    const nextFound = [...found, word].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    const nextScore = (current?.score ?? 0) + scoreGain;

    if (!current) {
      try {
        await HiveRound.create({
          userId,
          date,
          found: nextFound,
          score: nextScore,
        });
        return { found: nextFound, score: nextScore };
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
      { $set: { found: nextFound, score: nextScore } }
    );
    if (saved.matchedCount === 1) return { found: nextFound, score: nextScore };
  }
  throw new Error('Failed to store hive guess');
}

export async function submitHiveGuess(firebaseUid: string, body: unknown, now = new Date()) {
  const user = await requireUser(firebaseUid);
  if (!user) return { status: 404 as const, body: { error: 'User not found' } };

  const day = await ensureDay(now);
  const round = await playerRound(user._id, day.date);
  const found = new Set(round?.found ?? []);
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
    day.answers.length
  );
  if (stored === 'closed') {
    return { status: 200 as const, body: { valid: false, reason: 'day_closed' } };
  }
  if (stored === 'duplicate') {
    return { status: 200 as const, body: { valid: false, reason: 'already_found' } };
  }
  return {
    status: 200 as const,
    body: { valid: true, round: viewFor(day, stored.found, stored.score) },
  };
}
