import {
  OVERNIGHT_DAILY_PRIZE_COINS,
  OVERNIGHT_PRIZE_PUSH_HOUR_ISRAEL,
} from '../constants/daily';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { User } from '../models/User';
import { isAtOrAfterJerusalemHour, isBeforeLiveDailyKey } from '../utils/dailyClock';
import { sendDailyOvernightPrizePush } from './onesignal';

async function clearOvernightPrizeAwarded(dailyId: unknown): Promise<void> {
  await DailyPuzzle.updateOne(
    { _id: dailyId, overnightPrizeAwardedAt: { $ne: null } },
    { $set: { overnightPrizeAwardedAt: null } }
  );
}

async function clearOvernightPrizeNotified(dailyId: unknown): Promise<void> {
  await DailyPuzzle.updateOne(
    { _id: dailyId, overnightPrizeNotifiedAt: { $ne: null } },
    { $set: { overnightPrizeNotifiedAt: null } }
  );
}

/**
 * Credit 500 coins for prior-day #1 holders whose claim has frozen (after midnight).
 * Claims the award slot first (concurrency), then credits; rolls the claim back if
 * credit fails so the next tick can retry. Never leaves "awarded" without a successful $inc
 * when the user still exists.
 */
export async function creditOvernightDailyPrizes(now: Date = new Date()): Promise<number> {
  const candidates = await DailyPuzzle.find({
    fastestSolverId: { $ne: null },
    overnightPrizeAwardedAt: null,
  })
    .select('_id year dayOfYear fastestSolverId puzzleId')
    .lean();

  let awarded = 0;
  for (const daily of candidates) {
    if (!isBeforeLiveDailyKey(daily.year, daily.dayOfYear, now)) {
      continue;
    }
    if (!daily.fastestSolverId) {
      continue;
    }

    const claimed = await DailyPuzzle.findOneAndUpdate(
      {
        _id: daily._id,
        overnightPrizeAwardedAt: null,
        fastestSolverId: { $ne: null },
      },
      { $set: { overnightPrizeAwardedAt: new Date() } },
      { new: true }
    );

    if (!claimed?.fastestSolverId) {
      continue;
    }

    try {
      const credited = await User.findByIdAndUpdate(claimed.fastestSolverId, {
        $inc: { coins: OVERNIGHT_DAILY_PRIZE_COINS },
      });

      if (!credited) {
        // User gone — keep awarded claim so we do not retry forever, and park
        // notify so the morning job does not keep selecting this daily.
        await DailyPuzzle.updateOne(
          { _id: claimed._id, overnightPrizeNotifiedAt: null },
          { $set: { overnightPrizeNotifiedAt: new Date() } }
        );
        console.error(
          `Overnight prize: user ${String(claimed.fastestSolverId)} not found for daily ${String(claimed._id)}; skipped credit and notify`
        );
        continue;
      }

      awarded += 1;
    } catch (error) {
      await clearOvernightPrizeAwarded(claimed._id);
      console.error(
        `Overnight prize: failed to credit user ${String(claimed.fastestSolverId)} for daily ${String(claimed._id)}; claim released`,
        error
      );
    }
  }

  return awarded;
}

/** Send morning push for winners who already received coins (at/after 09:00 Israel). */
export async function notifyOvernightDailyPrizeWinners(
  now: Date = new Date()
): Promise<number> {
  if (!isAtOrAfterJerusalemHour(OVERNIGHT_PRIZE_PUSH_HOUR_ISRAEL, now)) {
    return 0;
  }

  const candidates = await DailyPuzzle.find({
    overnightPrizeAwardedAt: { $ne: null },
    overnightPrizeNotifiedAt: null,
    fastestSolverId: { $ne: null },
  })
    .select('_id year dayOfYear fastestSolverId puzzleId')
    .lean();

  let notified = 0;
  for (const daily of candidates) {
    if (!isBeforeLiveDailyKey(daily.year, daily.dayOfYear, now)) {
      continue;
    }

    const user = await User.findById(daily.fastestSolverId)
      .select('firebaseUid')
      .lean();
    if (!user?.firebaseUid) {
      continue;
    }

    const claimed = await DailyPuzzle.findOneAndUpdate(
      {
        _id: daily._id,
        overnightPrizeAwardedAt: { $ne: null },
        overnightPrizeNotifiedAt: null,
        fastestSolverId: { $ne: null },
      },
      { $set: { overnightPrizeNotifiedAt: new Date() } },
      { new: true }
    );

    if (!claimed?.fastestSolverId) {
      continue;
    }

    try {
      const sent = await sendDailyOvernightPrizePush({
        toUserId: user.firebaseUid,
        prizeCoins: OVERNIGHT_DAILY_PRIZE_COINS,
        puzzleId: String(claimed.puzzleId),
      });

      if (!sent) {
        await clearOvernightPrizeNotified(claimed._id);
        console.error(
          `Overnight prize: push failed for daily ${String(claimed._id)}; notify claim released`
        );
        continue;
      }

      notified += 1;
    } catch (error) {
      await clearOvernightPrizeNotified(claimed._id);
      console.error(
        `Overnight prize: push error for daily ${String(claimed._id)}; notify claim released`,
        error
      );
    }
  }

  return notified;
}

export async function processOvernightDailyPrizes(now: Date = new Date()): Promise<{
  awarded: number;
  notified: number;
}> {
  const awarded = await creditOvernightDailyPrizes(now);
  const notified = await notifyOvernightDailyPrizeWinners(now);
  return { awarded, notified };
}
