import { FIVE_HOUR_PRIZE_COINS } from '../utils/fiveLetters';
import { isBeforeLiveJerusalemHour } from '../utils/dailyClock';
import { FiveLetterDay } from '../models/FiveLetterDay';
import { User } from '../models/User';
import { sendFiveLetterHourPrizePush } from './onesignal';

async function clearPrizeAwarded(hourId: unknown): Promise<void> {
  await FiveLetterDay.updateOne(
    { _id: hourId, prizeAwardedAt: { $ne: null } },
    { $set: { prizeAwardedAt: null } }
  );
}

async function clearPrizeNotified(hourId: unknown): Promise<void> {
  await FiveLetterDay.updateOne(
    { _id: hourId, prizeNotifiedAt: { $ne: null } },
    { $set: { prizeNotifiedAt: null } }
  );
}

/**
 * Credit 300 coins to each closed hour's fastest solver. The claim is taken
 * before the credit and released if the credit fails, so a retry cannot pay twice.
 * The live hour is left alone.
 */
export async function creditFiveLetterHourPrizes(now: Date = new Date()): Promise<number> {
  const candidates = await FiveLetterDay.find({
    fastestSolverId: { $ne: null },
    prizeAwardedAt: null,
  })
    .select('_id date fastestSolverId')
    .lean();

  let awarded = 0;
  for (const hour of candidates) {
    if (!isBeforeLiveJerusalemHour(hour.date, now)) continue;
    if (!hour.fastestSolverId) continue;

    const claimed = await FiveLetterDay.findOneAndUpdate(
      {
        _id: hour._id,
        prizeAwardedAt: null,
        fastestSolverId: { $ne: null },
      },
      { $set: { prizeAwardedAt: new Date() } },
      { new: true }
    );
    if (!claimed?.fastestSolverId) continue;

    try {
      const credited = await User.findByIdAndUpdate(claimed.fastestSolverId, {
        $inc: { coins: FIVE_HOUR_PRIZE_COINS },
      });
      if (!credited) {
        await FiveLetterDay.updateOne(
          { _id: claimed._id, prizeNotifiedAt: null },
          { $set: { prizeNotifiedAt: new Date() } }
        );
        console.error(
          `Five letter hour prize: user ${String(claimed.fastestSolverId)} not found for ${claimed.date}; skipped credit and notify`
        );
        continue;
      }
      awarded += 1;
    } catch (error) {
      await clearPrizeAwarded(claimed._id);
      console.error(
        `Five letter hour prize: failed to credit user ${String(claimed.fastestSolverId)} for ${claimed.date}; claim released`,
        error
      );
    }
  }

  return awarded;
}

/** Push winners who already received this hour's coins. */
export async function notifyFiveLetterHourPrizeWinners(now: Date = new Date()): Promise<number> {
  const candidates = await FiveLetterDay.find({
    prizeAwardedAt: { $ne: null },
    prizeNotifiedAt: null,
    fastestSolverId: { $ne: null },
  })
    .select('_id date fastestSolverId')
    .lean();

  let notified = 0;
  for (const hour of candidates) {
    if (!isBeforeLiveJerusalemHour(hour.date, now)) continue;

    const user = await User.findById(hour.fastestSolverId).select('firebaseUid').lean();
    if (!user?.firebaseUid) continue;

    const claimed = await FiveLetterDay.findOneAndUpdate(
      {
        _id: hour._id,
        prizeAwardedAt: { $ne: null },
        prizeNotifiedAt: null,
        fastestSolverId: { $ne: null },
      },
      { $set: { prizeNotifiedAt: new Date() } },
      { new: true }
    );
    if (!claimed?.fastestSolverId) continue;

    try {
      const sent = await sendFiveLetterHourPrizePush({
        toUserId: user.firebaseUid,
        prizeCoins: FIVE_HOUR_PRIZE_COINS,
        hour: claimed.date,
      });
      if (!sent) {
        await clearPrizeNotified(claimed._id);
        console.error(
          `Five letter hour prize: push failed for ${claimed.date}; notify claim released`
        );
        continue;
      }
      notified += 1;
    } catch (error) {
      await clearPrizeNotified(claimed._id);
      console.error(
        `Five letter hour prize: push error for ${claimed.date}; notify claim released`,
        error
      );
    }
  }

  return notified;
}

export async function processFiveLetterHourPrizes(now: Date = new Date()): Promise<{
  awarded: number;
  notified: number;
}> {
  const awarded = await creditFiveLetterHourPrizes(now);
  const notified = await notifyFiveLetterHourPrizeWinners(now);
  return { awarded, notified };
}
