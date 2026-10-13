import { randomInt } from 'crypto';
import {
  REWARD_SPIN_CREATE_LIMIT,
  REWARD_SPIN_CREATE_WINDOW_MS,
  REWARD_SPIN_TTL_MS,
  REWARD_SPIN_WHEEL_FACE,
  RewardSpinAmount,
} from '../constants/rewardSpins';

export interface PickedRewardSpin {
  sliceIndex: number;
  amount: RewardSpinAmount;
}

/**
 * Pick one of the 12 wheel slices uniformly. Face multiplicity gives the
 * intended weights (50×3, 100×3, 200×2, 300×2, 500×1, 1000×1).
 */
export function pickRewardSpinSlice(
  face: readonly number[] = REWARD_SPIN_WHEEL_FACE,
  pickIndex: (length: number) => number = (length) => randomInt(length)
): PickedRewardSpin {
  if (face.length === 0) {
    throw new Error('Reward spin wheel face is empty');
  }
  const sliceIndex = pickIndex(face.length);
  if (!Number.isInteger(sliceIndex) || sliceIndex < 0 || sliceIndex >= face.length) {
    throw new Error('Invalid reward spin slice index');
  }
  return {
    sliceIndex,
    amount: face[sliceIndex] as RewardSpinAmount,
  };
}

export function rewardSpinExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + REWARD_SPIN_TTL_MS);
}

export function isRewardSpinExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function rewardSpinCreateWindowStart(
  now: Date = new Date(),
  windowMs: number = REWARD_SPIN_CREATE_WINDOW_MS
): Date {
  return new Date(now.getTime() - windowMs);
}

export function isRewardSpinCreateRateLimited(
  createsInWindow: number,
  limit: number = REWARD_SPIN_CREATE_LIMIT
): boolean {
  return createsInWindow >= limit;
}
