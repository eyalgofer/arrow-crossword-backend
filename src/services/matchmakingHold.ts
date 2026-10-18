import mongoose from 'mongoose';
import { POT_BOOST_AMOUNT, RANDOM_QUEUE_STAKE } from '../constants/stakes';
import { IMatchmakingHold, MatchmakingHold } from '../models/MatchmakingHold';
import { User } from '../models/User';
import { headlinePot } from './prizeSettlement';
import { creditUser, escrowPlayers } from './prizeEscrow';

export interface OpenedHold {
  hold: IMatchmakingHold;
  coins: number;
  reused: boolean;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error != null && (error as { code?: number }).code === 11000;
}

function boostCredit(hold: { stake: number; boost?: { amount: number; status: string } | null }): number {
  const boost = hold.boost?.status === 'claimed' ? hold.boost.amount : 0;
  return hold.stake + boost;
}

/**
 * Escrow the random-queue stake and remember it so a disconnect or restart
 * can give the coins back. A second search while one is open reuses the hold.
 */
export async function openSearchHold(args: {
  userId: string;
  firebaseUid: string;
  stake: number;
}): Promise<OpenedHold> {
  const existing = await MatchmakingHold.findOne({ userId: args.userId, status: 'searching' });
  if (existing) {
    const user = await User.findById(args.userId).select('coins');
    return { hold: existing, coins: user?.coins ?? existing.coins, reused: true };
  }

  const balances = await escrowPlayers([{ userId: args.userId, stake: args.stake }], args.userId);
  const coins = balances[args.userId] ?? 0;

  try {
    const hold = await MatchmakingHold.create({
      userId: args.userId,
      firebaseUid: args.firebaseUid,
      stake: args.stake,
      status: 'searching',
      boost: null,
      coins
    });
    return { hold, coins, reused: false };
  } catch (error) {
    if (!isDuplicateKey(error)) {
      await creditUser(args.userId, args.stake);
      throw error;
    }
    await creditUser(args.userId, args.stake);
    const raced = await MatchmakingHold.findOne({ userId: args.userId, status: 'searching' });
    if (!raced) {
      throw error;
    }
    return { hold: raced, coins: raced.coins, reused: true };
  }
}

/** Refund a searching hold. Returns the new balance, or null when nothing was held. */
export async function refundSearchHold(userId: string): Promise<number | null> {
  const hold = await MatchmakingHold.findOneAndUpdate(
    { userId, status: 'searching' },
    { $set: { status: 'refunded' } },
    { new: false }
  );
  if (!hold) {
    return null;
  }
  return creditUser(userId, boostCredit(hold));
}

export async function refundSearchHoldByFirebase(firebaseUid: string): Promise<number | null> {
  const hold = await MatchmakingHold.findOneAndUpdate(
    { firebaseUid, status: 'searching' },
    { $set: { status: 'refunded' } },
    { new: false }
  );
  if (!hold) {
    return null;
  }
  return creditUser(hold.userId.toString(), boostCredit(hold));
}

/** Process boot: the in-memory queue is empty, so any leftover search escrow goes back. */
export async function refundAllSearchingHolds(): Promise<void> {
  const holds = await MatchmakingHold.find({ status: 'searching' }).select('userId');
  for (const hold of holds) {
    await refundSearchHold(hold.userId.toString());
  }
}

/**
 * Move searching holds to matched so they become the match pot.
 * If either player is no longer searching, everyone requested is refunded.
 */
export async function claimSearchHolds(userIds: string[]): Promise<IMatchmakingHold[] | null> {
  const claimed: IMatchmakingHold[] = [];
  try {
    for (const userId of userIds) {
      const hold = await MatchmakingHold.findOneAndUpdate(
        { userId, status: 'searching' },
        { $set: { status: 'matched' } },
        { new: true }
      );
      if (!hold) {
        await releaseMatchedHolds(claimed);
        await Promise.all(userIds.map(id => refundSearchHold(id)));
        return null;
      }
      claimed.push(hold);
    }
    return claimed;
  } catch (error) {
    await releaseMatchedHolds(claimed);
    await Promise.all(userIds.map(id => refundSearchHold(id)));
    throw error;
  }
}

/** Give back stake and a claimed boost for holds we matched but will not start. */
export async function releaseMatchedHolds(holds: IMatchmakingHold[]): Promise<void> {
  for (const hold of holds) {
    const locked = await MatchmakingHold.findOneAndUpdate(
      { _id: hold._id, status: 'matched' },
      { $set: { status: 'refunded' } },
      { new: false }
    );
    if (!locked) {
      continue;
    }
    await creditUser(locked.userId.toString(), boostCredit(locked));
  }
}

export async function createQueueBoost(userId: string): Promise<
  | { ok: true; boostId: string; amount: number }
  | { ok: false; status: number; body: { error: string } }
> {
  const hold = await MatchmakingHold.findOne({ userId, status: 'searching' });
  if (!hold) {
    return { ok: false, status: 409, body: { error: 'Not in the queue' } };
  }
  if (hold.boost?.boostId) {
    return { ok: true, boostId: hold.boost.boostId, amount: hold.boost.amount };
  }

  const boostId = new mongoose.Types.ObjectId().toString();
  const updated = await MatchmakingHold.findOneAndUpdate(
    { _id: hold._id, status: 'searching', $or: [{ boost: null }, { boost: { $exists: false } }] },
    { $set: { boost: { boostId, amount: POT_BOOST_AMOUNT, status: 'pending' } } },
    { new: true }
  );
  if (!updated) {
    const latest = await MatchmakingHold.findOne({ userId, status: 'searching' });
    if (latest?.boost?.boostId) {
      return { ok: true, boostId: latest.boost.boostId, amount: latest.boost.amount };
    }
    return { ok: false, status: 409, body: { error: 'Not in the queue' } };
  }
  return { ok: true, boostId, amount: POT_BOOST_AMOUNT };
}

export async function claimQueueBoost(userId: string, boostId: string): Promise<
  | { ok: true; pot: number }
  | { ok: false; status: number; body: { error: string } }
> {
  const hold = await MatchmakingHold.findOne({ userId, status: 'searching' });
  if (!hold) {
    return { ok: false, status: 409, body: { error: 'Not in the queue' } };
  }
  if (!hold.boost || hold.boost.boostId !== boostId) {
    return { ok: false, status: 404, body: { error: 'Boost not found' } };
  }

  if (hold.boost.status !== 'claimed') {
    await MatchmakingHold.updateOne(
      { _id: hold._id, status: 'searching', 'boost.boostId': boostId, 'boost.status': 'pending' },
      { $set: { 'boost.status': 'claimed' } }
    );
  }

  return { ok: true, pot: headlinePot(RANDOM_QUEUE_STAKE, hold.boost.amount) };
}

export function claimedBoostsFromHolds(
  holds: IMatchmakingHold[]
): Array<{ userId: mongoose.Types.ObjectId; amount: number }> {
  return holds.flatMap(hold => (
    hold.boost?.status === 'claimed'
      ? [{ userId: hold.userId, amount: hold.boost.amount }]
      : []
  ));
}
