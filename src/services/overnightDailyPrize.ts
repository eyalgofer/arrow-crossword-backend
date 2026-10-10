import {
  OVERNIGHT_DAILY_PRIZE_COINS,
  OVERNIGHT_PRIZE_PUSH_HOUR_ISRAEL,
} from '../constants/daily';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { User } from '../models/User';
import { isAtOrAfterJerusalemHour, isBeforeLiveDailyKey } from '../utils/dailyClock';
import { sendDailyOvernightPrizePush } from './onesignal';

/** Credit 500 coins for prior-day #1 holders whose claim has frozen (after midnight). */
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

    await User.findByIdAndUpdate(claimed.fastestSolverId, {
      $inc: { coins: OVERNIGHT_DAILY_PRIZE_COINS },
    });
    awarded += 1;
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

    const user = await User.findById(claimed.fastestSolverId)
      .select('firebaseUid')
      .lean();
    if (!user?.firebaseUid) {
      continue;
    }

    await sendDailyOvernightPrizePush({
      toUserId: user.firebaseUid,
      prizeCoins: OVERNIGHT_DAILY_PRIZE_COINS,
      puzzleId: String(claimed.puzzleId),
    });
    notified += 1;
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
