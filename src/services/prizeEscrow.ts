import mongoose from 'mongoose';
import { User } from '../models/User';

export class InsufficientCoinsError extends Error {
  readonly code = 'insufficient_coins';

  constructor(
    readonly userId: string,
    readonly stake: number,
    readonly coins: number
  ) {
    super('Not enough coins');
    this.name = 'InsufficientCoinsError';
  }
}

export function insufficientCoinsBody(error: InsufficientCoinsError): {
  code: 'insufficient_coins';
  message: string;
  userId: string;
  stake: number;
  coins: number;
} {
  return {
    code: 'insufficient_coins',
    message: 'Not enough coins',
    userId: error.userId,
    stake: error.stake,
    coins: error.coins
  };
}

export interface EscrowEntry {
  userId: string;
  stake: number;
}

/**
 * Hold `stake` from each player in one transaction. A short wallet aborts the
 * whole charge. `callerId` is checked first so the caller hears about their
 * own shortage before someone else's.
 */
export async function escrowPlayers(
  entries: EscrowEntry[],
  callerId?: string
): Promise<Record<string, number>> {
  const ordered = [...entries];
  if (callerId) {
    ordered.sort((a, b) => Number(b.userId === callerId) - Number(a.userId === callerId));
  }

  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const balances: Record<string, number> = {};

      for (const entry of ordered) {
        const user = await User.findById(entry.userId).session(session).select('coins');
        if (!user) {
          throw new Error(`User not found: ${entry.userId}`);
        }
        if (entry.stake > 0 && user.coins < entry.stake) {
          throw new InsufficientCoinsError(entry.userId, entry.stake, user.coins);
        }
        balances[entry.userId] = user.coins;
      }

      for (const entry of ordered) {
        if (entry.stake <= 0) {
          continue;
        }
        const updated = await User.findOneAndUpdate(
          { _id: entry.userId, coins: { $gte: entry.stake } },
          { $inc: { coins: -entry.stake } },
          { new: true, session }
        ).select('coins');
        if (!updated) {
          const latest = await User.findById(entry.userId).session(session).select('coins');
          throw new InsufficientCoinsError(entry.userId, entry.stake, latest?.coins ?? 0);
        }
        balances[entry.userId] = updated.coins;
      }

      return balances;
    });
  } finally {
    await session.endSession();
  }
}

/** Credit coins and return the new absolute balance. */
export async function creditUser(userId: string, amount: number): Promise<number> {
  if (amount <= 0) {
    const user = await User.findById(userId).select('coins');
    return user?.coins ?? 0;
  }
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { coins: amount } },
    { new: true }
  ).select('coins');
  return updated?.coins ?? 0;
}

export async function refundUsers(userIds: string[], amount: number): Promise<void> {
  if (amount <= 0 || userIds.length === 0) {
    return;
  }
  await Promise.all(userIds.map(userId => creditUser(userId, amount)));
}
