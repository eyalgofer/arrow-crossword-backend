import mongoose from 'mongoose';
import { REWARD_SPIN_CREATE_LIMIT, REWARD_SPIN_WHEEL_FACE } from '../constants/rewardSpins';
import { RewardSpin, RewardSpinStatus } from '../models/RewardSpin';
import { User } from '../models/User';
import {
  isRewardSpinCreateRateLimited,
  isRewardSpinExpired,
  pickRewardSpinSlice,
  rewardSpinCreateWindowStart,
  rewardSpinExpiresAt,
} from '../utils/rewardSpins';

export interface RewardSpinView {
  spinId: string;
  amount: number;
  sliceIndex: number;
  expiresAt: string;
  wheelFace: readonly number[];
}

function toSpinView(spin: {
  _id: mongoose.Types.ObjectId;
  amount: number;
  sliceIndex: number;
  expiresAt: Date;
}): RewardSpinView {
  return {
    spinId: String(spin._id),
    amount: spin.amount,
    sliceIndex: spin.sliceIndex,
    expiresAt: spin.expiresAt.toISOString(),
    wheelFace: REWARD_SPIN_WHEEL_FACE,
  };
}

async function findUserByFirebaseUid(firebaseUid: string) {
  return User.findOne({ firebaseUid }).select('_id coins');
}

/** Discard every pending spin for this user (closing dialog / opening a new one). */
async function discardPendingSpins(
  userId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession
): Promise<void> {
  const now = new Date();
  await RewardSpin.updateMany(
    { userId, status: RewardSpinStatus.PENDING },
    {
      $set: {
        status: RewardSpinStatus.DISCARDED,
        discardedAt: now,
      },
    },
    session ? { session } : undefined
  );
}

export async function createRewardSpin(firebaseUid: string): Promise<{ status: number; body: object }> {
  const user = await findUserByFirebaseUid(firebaseUid);
  if (!user) {
    return { status: 404, body: { error: 'User not found' } };
  }

  const windowStart = rewardSpinCreateWindowStart();
  const createsInWindow = await RewardSpin.countDocuments({
    userId: user._id,
    createdAt: { $gte: windowStart },
  });
  if (isRewardSpinCreateRateLimited(createsInWindow, REWARD_SPIN_CREATE_LIMIT)) {
    return {
      status: 429,
      body: {
        error: 'Too many reward spins',
        code: 'reward_spin_rate_limited',
        limit: REWARD_SPIN_CREATE_LIMIT,
      },
    };
  }

  const { sliceIndex, amount } = pickRewardSpinSlice();
  const expiresAt = rewardSpinExpiresAt();

  // Only the latest open dialog may be claimed.
  await discardPendingSpins(user._id);

  const spin = await RewardSpin.create({
    userId: user._id,
    amount,
    sliceIndex,
    status: RewardSpinStatus.PENDING,
    expiresAt,
  });

  return { status: 201, body: toSpinView(spin) };
}

export async function discardRewardSpin(
  firebaseUid: string,
  spinId: string
): Promise<{ status: number; body: object }> {
  if (!mongoose.isValidObjectId(spinId)) {
    return { status: 404, body: { error: 'Spin not found' } };
  }

  const user = await findUserByFirebaseUid(firebaseUid);
  if (!user) {
    return { status: 404, body: { error: 'User not found' } };
  }

  const spin = await RewardSpin.findOneAndUpdate(
    {
      _id: spinId,
      userId: user._id,
      status: RewardSpinStatus.PENDING,
    },
    {
      $set: {
        status: RewardSpinStatus.DISCARDED,
        discardedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!spin) {
    const existing = await RewardSpin.findOne({ _id: spinId, userId: user._id }).select('status');
    if (!existing) {
      return { status: 404, body: { error: 'Spin not found' } };
    }
    return {
      status: 409,
      body: {
        error: 'Spin is no longer pending',
        code: 'reward_spin_not_pending',
        status: existing.status,
      },
    };
  }

  return { status: 200, body: { spinId: String(spin._id), status: spin.status } };
}

export async function claimRewardSpin(
  firebaseUid: string,
  spinId: string
): Promise<{ status: number; body: object }> {
  if (!mongoose.isValidObjectId(spinId)) {
    return { status: 404, body: { error: 'Spin not found' } };
  }

  const user = await findUserByFirebaseUid(firebaseUid);
  if (!user) {
    return { status: 404, body: { error: 'User not found' } };
  }

  const now = new Date();
  const pending = await RewardSpin.findOne({
    _id: spinId,
    userId: user._id,
  });

  if (!pending) {
    return { status: 404, body: { error: 'Spin not found' } };
  }

  if (pending.status === RewardSpinStatus.CLAIMED) {
    return {
      status: 409,
      body: {
        error: 'Spin already claimed',
        code: 'reward_spin_already_claimed',
        amount: pending.amount,
      },
    };
  }

  if (pending.status !== RewardSpinStatus.PENDING) {
    return {
      status: 409,
      body: {
        error: 'Spin is no longer pending',
        code: 'reward_spin_not_pending',
        status: pending.status,
      },
    };
  }

  if (isRewardSpinExpired(pending.expiresAt, now)) {
    pending.status = RewardSpinStatus.DISCARDED;
    pending.discardedAt = now;
    await pending.save();
    return {
      status: 409,
      body: {
        error: 'Spin expired',
        code: 'reward_spin_expired',
      },
    };
  }

  // Atomic claim so double-tap / concurrent claim cannot double-credit.
  const claimed = await RewardSpin.findOneAndUpdate(
    {
      _id: pending._id,
      userId: user._id,
      status: RewardSpinStatus.PENDING,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: RewardSpinStatus.CLAIMED,
        claimedAt: now,
      },
    },
    { new: true }
  );

  if (!claimed) {
    return {
      status: 409,
      body: {
        error: 'Spin is no longer claimable',
        code: 'reward_spin_not_pending',
      },
    };
  }

  const credited = await User.findByIdAndUpdate(
    user._id,
    { $inc: { coins: claimed.amount } },
    { new: true }
  ).select('coins');

  if (!credited) {
    // Extremely unlikely after a successful claim lock; roll claim back.
    await RewardSpin.updateOne(
      { _id: claimed._id, status: RewardSpinStatus.CLAIMED },
      {
        $set: {
          status: RewardSpinStatus.PENDING,
          claimedAt: null,
        },
      }
    );
    return { status: 404, body: { error: 'User not found' } };
  }

  return {
    status: 200,
    body: {
      spinId: String(claimed._id),
      amount: claimed.amount,
      coins: credited.coins,
    },
  };
}
