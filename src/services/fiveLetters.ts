import mongoose, { PipelineStage, Types } from 'mongoose';
import { FiveLetterDay } from '../models/FiveLetterDay';
import { FiveLetterRound, IFiveLetterRound } from '../models/FiveLetterRound';
import { FiveLetterWord } from '../models/FiveLetterWord';
import { User } from '../models/User';
import { isRealFiveLetterWord, sortedFiveLetterWords } from './fiveLetterLexicon';
import { jerusalemHourKey, nextJerusalemHour } from '../utils/dailyClock';
import {
  FIVE_ENTRY_COST,
  FIVE_LETTER_SEED_WORD,
  StoredFiveLetterRound,
  applyGuess,
  classifyGuess,
  emptyFiveLetterRound,
  fiveLetterHourNumber,
  normalizeFiveWord,
  pickFiveLetterWord,
  toFiveLetterCard,
  toFiveLetterRoundView,
  wholeSeconds,
  type FiveLetterCommunity,
  type FiveLetterRoundView,
} from '../utils/fiveLetters';

interface DayAssignment {
  date: string;
  endsAt: string;
  word: string;
  solvedCount: number;
  fastestSeconds: number | null;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error != null && (error as { code?: number }).code === 11000;
}

function bodyOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function storedRound(round: IFiveLetterRound | null): StoredFiveLetterRound | null {
  if (!round) return null;
  return {
    status: round.status,
    guesses: round.guesses.map((guess) => ({
      word: guess.word,
      marks: guess.marks as StoredFiveLetterRound['guesses'][number]['marks'],
    })),
    elapsedSeconds: round.elapsedSeconds ?? null,
    completionSeconds: round.completionSeconds ?? null,
  };
}

/**
 * Mirrors `recordSolve`. One update so two wins cannot leave the slower time
 * in place, and a null completion does not clear a real fastest time.
 */
function isFaster(completionSeconds: number): Record<string, unknown> {
  return {
    $or: [
      { $eq: ['$fastestSeconds', null] },
      { $lt: [completionSeconds, '$fastestSeconds'] },
    ],
  };
}

function winStatsPipeline(completionSeconds: number | null, userId: Types.ObjectId): PipelineStage[] {
  const hasTime = completionSeconds != null;
  const claimsPrize = completionSeconds != null && completionSeconds > 0;
  const fastestSeconds = !hasTime
    ? '$fastestSeconds'
    : {
        $cond: {
          if: isFaster(completionSeconds),
          then: completionSeconds,
          else: '$fastestSeconds',
        },
      };
  const fastestSolverId = !claimsPrize
    ? '$fastestSolverId'
    : {
        $cond: {
          if: isFaster(completionSeconds),
          then: userId,
          else: '$fastestSolverId',
        },
      };

  return [
    {
      $set: {
        solvedCount: { $add: [{ $ifNull: ['$solvedCount', 0] }, 1] },
        fastestSeconds,
        fastestSolverId,
      },
    },
  ];
}

export async function ensureFiveLetterSeed(): Promise<void> {
  const enabled = await FiveLetterWord.countDocuments({ enabled: true, locale: 'he' });
  if (enabled > 0) return;
  // No enabled word means today cannot be chosen. Put the seed back.
  // Two servers can both insert; the unique index keeps one.
  try {
    await FiveLetterWord.updateOne(
      { word: FIVE_LETTER_SEED_WORD, locale: 'he' },
      { $set: { word: FIVE_LETTER_SEED_WORD, locale: 'he', enabled: true } },
      { upsert: true }
    );
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }
}

async function chooseWord(now: Date): Promise<{ word: string; wordId: string | null } | null> {
  const hourNumber = fiveLetterHourNumber(now);
  const lexicon = sortedFiveLetterWords();
  if (lexicon.length > 0) {
    const picked = pickFiveLetterWord(
      lexicon.map((word) => ({ word, _id: word })),
      hourNumber
    );
    return picked ? { word: picked.word, wordId: null } : null;
  }

  const load = () =>
    FiveLetterWord.find({ enabled: true, locale: 'he' }).select('word').lean();

  let rows = await load();
  if (rows.length === 0) {
    await ensureFiveLetterSeed();
    rows = await load();
  }

  const picked = pickFiveLetterWord(
    rows.map((row) => ({ word: normalizeFiveWord(row.word), _id: String(row._id) })),
    hourNumber
  );
  return picked ? { word: picked.word, wordId: picked._id } : null;
}

/** Pins this hour's word on first use so a later insert does not change it. */
async function ensureDay(now: Date): Promise<DayAssignment> {
  const date = jerusalemHourKey(now);
  const endsAt = nextJerusalemHour(now).toISOString();
  const existing = await FiveLetterDay.findOne({ date }).lean();
  if (existing) {
    return {
      date,
      endsAt,
      word: normalizeFiveWord(existing.word),
      solvedCount: existing.solvedCount ?? 0,
      fastestSeconds: existing.fastestSeconds ?? null,
    };
  }

  const chosen = await chooseWord(now);
  if (!chosen) {
    throw new Error('No five letter word available');
  }

  try {
    const created = await FiveLetterDay.findOneAndUpdate(
      { date },
      {
        $setOnInsert: {
          date,
          ...(chosen.wordId ? { wordId: chosen.wordId } : {}),
          word: chosen.word,
          solvedCount: 0,
          fastestSeconds: null,
        },
      },
      { upsert: true, new: true }
    ).lean();
    if (!created) throw new Error('No five letter word available');
    return {
      date,
      endsAt,
      word: normalizeFiveWord(created.word),
      solvedCount: created.solvedCount ?? 0,
      fastestSeconds: created.fastestSeconds ?? null,
    };
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const again = await FiveLetterDay.findOne({ date }).lean();
    if (!again) throw error;
    return {
      date,
      endsAt,
      word: normalizeFiveWord(again.word),
      solvedCount: again.solvedCount ?? 0,
      fastestSeconds: again.fastestSeconds ?? null,
    };
  }
}

/**
 * Claim the win, then add it to the day's counters. The claim is inside the
 * transaction, so a retry after a failed write does not count the player twice.
 */
async function countWin(date: string, roundId: Types.ObjectId): Promise<void> {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const claimed = await FiveLetterRound.findOneAndUpdate(
        { _id: roundId, status: 'won', winCounted: { $ne: true } },
        { $set: { winCounted: true } },
        { session }
      );
      if (!claimed) return;
      await FiveLetterDay.updateOne(
        { date },
        winStatsPipeline(claimed.completionSeconds ?? null, claimed.userId),
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
}

/** Fold wins that were stored but not yet added to the community counters. */
async function countPendingWins(date: string): Promise<void> {
  for (let batch = 0; batch < 20; batch += 1) {
    const pending = await FiveLetterRound.find({
      date,
      status: 'won',
      winCounted: { $ne: true },
    })
      .select('_id')
      .limit(100)
      .lean();
    if (pending.length === 0) return;
    for (const round of pending) {
      await countWin(date, round._id);
    }
    if (pending.length < 100) return;
  }
}

async function communityStats(date: string): Promise<FiveLetterCommunity> {
  await countPendingWins(date);
  const day = await FiveLetterDay.findOne({ date }).select('solvedCount fastestSeconds').lean();
  return {
    solvedCount: day?.solvedCount ?? 0,
    fastestSeconds: day?.fastestSeconds ?? null,
  };
}

function viewFor(
  day: DayAssignment,
  round: StoredFiveLetterRound | null,
  community: FiveLetterCommunity,
  entryPaid = false
): FiveLetterRoundView {
  return toFiveLetterRoundView({
    date: day.date,
    endsAt: day.endsAt,
    answer: day.word,
    round,
    solvedCount: community.solvedCount,
    fastestSeconds: community.fastestSeconds,
    entryPaid,
  });
}

async function requireUser(firebaseUid: string) {
  return User.findOne({ firebaseUid }).select('_id');
}

export async function getFiveLetterCardForUser(firebaseUid: string, now = new Date()) {
  const user = await requireUser(firebaseUid);
  if (!user) return { status: 404 as const, body: { error: 'User not found' } };

  const round = await FiveLetterRound.findOne({
    userId: user._id,
    date: jerusalemHourKey(now),
  });
  return { status: 200 as const, body: toFiveLetterCard(storedRound(round)) };
}

export async function getFiveLetterSolvedCountForDate(now = new Date()) {
  const day = await ensureDay(now);
  const community = await communityStats(day.date);
  return { status: 200 as const, body: community };
}

export async function getFiveLetterTodayForUser(firebaseUid: string, now = new Date()) {
  const user = await requireUser(firebaseUid);
  if (!user) return { status: 404 as const, body: { error: 'User not found' } };

  const day = await ensureDay(now);
  const round = await FiveLetterRound.findOne({ userId: user._id, date: day.date });
  const community = await communityStats(day.date);
  return {
    status: 200 as const,
    body: viewFor(day, storedRound(round), community, round?.entryPaid === true),
  };
}

async function storeGuess(
  userId: Types.ObjectId,
  date: string,
  word: string,
  answer: string,
  elapsed: number | null
): Promise<StoredFiveLetterRound | 'closed'> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await FiveLetterRound.findOne({ userId, date });
    const applied = applyGuess(storedRound(current) ?? emptyFiveLetterRound(), word, answer, elapsed);
    if (!applied.ok) return 'closed';

    if (!current) {
      try {
        await FiveLetterRound.create({
          userId,
          date,
          status: applied.round.status,
          guesses: applied.round.guesses,
          elapsedSeconds: applied.round.elapsedSeconds,
          completionSeconds: applied.round.completionSeconds,
          winCounted: false,
        });
        return applied.round;
      } catch (error) {
        if (isDuplicateKey(error)) continue;
        throw error;
      }
    }

    const saved = await FiveLetterRound.updateOne(
      {
        _id: current._id,
        status: 'playing',
        $expr: { $eq: [{ $size: '$guesses' }, current.guesses.length] },
      },
      {
        $set: {
          status: applied.round.status,
          guesses: applied.round.guesses,
          elapsedSeconds: applied.round.elapsedSeconds,
          completionSeconds: applied.round.completionSeconds,
          ...(applied.wonNow ? { winCounted: false } : {}),
        },
      }
    );
    if (saved.matchedCount === 1) return applied.round;
  }
  throw new Error('Failed to store five letter guess');
}

function roundIsClosed(round: IFiveLetterRound | null): boolean {
  return round != null && (round.status !== 'playing' || round.guesses.length >= 5);
}

/**
 * Take the 100-coin entry once per player per hour. The claim is stored on the
 * round before the debit, and released if the player cannot pay, so two
 * guesses cannot charge twice and a failed debit can be retried.
 */
async function chargeEntry(
  userId: Types.ObjectId,
  date: string
): Promise<{ ok: true; coins?: number } | { ok: false; reason: 'insufficient' | 'closed' }> {
  let round = await FiveLetterRound.findOne({ userId, date });
  if (roundIsClosed(round)) return { ok: false, reason: 'closed' };
  if (round?.entryPaid) return { ok: true };

  if (!round) {
    try {
      round = await FiveLetterRound.create({
        userId,
        date,
        status: 'playing',
        guesses: [],
        elapsedSeconds: null,
        completionSeconds: null,
        winCounted: false,
        entryPaid: false,
      });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      round = await FiveLetterRound.findOne({ userId, date });
    }
  }
  if (!round) throw new Error('Failed to open five letter round');
  if (roundIsClosed(round)) return { ok: false, reason: 'closed' };
  if (round.entryPaid) return { ok: true };

  const claimed = await FiveLetterRound.findOneAndUpdate(
    { _id: round._id, entryPaid: { $ne: true } },
    { $set: { entryPaid: true } },
    { new: true }
  );
  if (!claimed) {
    const again = await FiveLetterRound.findById(round._id).select('entryPaid');
    if (again?.entryPaid) return { ok: true };
    return { ok: false, reason: 'insufficient' };
  }

  const charged = await User.findOneAndUpdate(
    { _id: userId, coins: { $gte: FIVE_ENTRY_COST } },
    { $inc: { coins: -FIVE_ENTRY_COST } },
    { new: true }
  ).select('coins');
  if (!charged) {
    await FiveLetterRound.updateOne({ _id: round._id }, { $set: { entryPaid: false } });
    return { ok: false, reason: 'insufficient' };
  }
  return { ok: true, coins: charged.coins };
}

export async function submitFiveLetterGuess(firebaseUid: string, body: unknown, now = new Date()) {
  const user = await requireUser(firebaseUid);
  if (!user) return { status: 404 as const, body: { error: 'User not found' } };

  const payload = bodyOf(body);
  const classified = classifyGuess(payload?.guess);
  if (!classified.ok) {
    return { status: 200 as const, body: { valid: false, reason: classified.reason } };
  }

  const liveHour = jerusalemHourKey(now);
  if (typeof payload?.date === 'string' && payload.date !== liveHour) {
    return { status: 200 as const, body: { valid: false, reason: 'round_closed' as const } };
  }

  const day = await ensureDay(now);
  // Any real five-letter word counts. This hour's answer stays valid even if
  // the clue list does not contain it.
  const answer = normalizeFiveWord(day.word);
  if (classified.word !== answer && !isRealFiveLetterWord(classified.word)) {
    return { status: 200 as const, body: { valid: false, reason: 'not_a_word' as const } };
  }

  const payment = await chargeEntry(user._id, day.date);
  if (!payment.ok && payment.reason === 'closed') {
    return { status: 200 as const, body: { valid: false, reason: 'round_closed' as const } };
  }
  if (!payment.ok) {
    return {
      status: 400 as const,
      body: { error: 'Insufficient coins', code: 'insufficient_coins' as const },
    };
  }

  const stored = await storeGuess(
    user._id,
    day.date,
    classified.word,
    day.word,
    wholeSeconds(payload?.elapsedSeconds)
  );
  if (stored === 'closed') {
    return { status: 200 as const, body: { valid: false, reason: 'round_closed' as const } };
  }

  const community = await communityStats(day.date);
  return {
    status: 200 as const,
    body: {
      valid: true,
      round: viewFor(day, stored, community, true),
      ...(payment.coins != null ? { coins: payment.coins } : {}),
    },
  };
}

export async function saveFiveLetterElapsedForUser(
  firebaseUid: string,
  body: unknown,
  now = new Date()
) {
  const user = await requireUser(firebaseUid);
  if (!user) return { status: 404 as const, body: { error: 'User not found' } };

  const elapsed = wholeSeconds(bodyOf(body)?.elapsedSeconds);
  if (elapsed == null) return { status: 200 as const, body: { ok: true } };

  const date = jerusalemHourKey(now);
  const updated = await FiveLetterRound.updateOne(
    { userId: user._id, date, status: 'playing' },
    { $set: { elapsedSeconds: elapsed } }
  );
  if (updated.matchedCount > 0) return { status: 200 as const, body: { ok: true } };

  const existing = await FiveLetterRound.exists({ userId: user._id, date });
  if (existing) return { status: 200 as const, body: { ok: true } };

  try {
    await FiveLetterRound.create({
      userId: user._id,
      date,
      status: 'playing',
      guesses: [],
      elapsedSeconds: elapsed,
      completionSeconds: null,
      winCounted: false,
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    await FiveLetterRound.updateOne(
      { userId: user._id, date, status: 'playing' },
      { $set: { elapsedSeconds: elapsed } }
    );
  }

  return { status: 200 as const, body: { ok: true } };
}

