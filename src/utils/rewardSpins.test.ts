import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  REWARD_SPIN_CREATE_LIMIT,
  REWARD_SPIN_TTL_MS,
  REWARD_SPIN_WHEEL_FACE,
} from '../constants/rewardSpins';
import {
  isRewardSpinCreateRateLimited,
  isRewardSpinExpired,
  pickRewardSpinSlice,
  rewardSpinCreateWindowStart,
  rewardSpinExpiresAt,
} from './rewardSpins';

describe('reward spin wheel', () => {
  it('matches the 12-slice face order from 12 o\'clock', () => {
    assert.deepEqual([...REWARD_SPIN_WHEEL_FACE], [
      50, 100, 200, 50, 300, 100, 500, 50, 200, 100, 1000, 300,
    ]);
  });

  it('encodes starting weights via face multiplicity', () => {
    const counts = new Map<number, number>();
    for (const amount of REWARD_SPIN_WHEEL_FACE) {
      counts.set(amount, (counts.get(amount) ?? 0) + 1);
    }
    assert.deepEqual(Object.fromEntries(counts), {
      50: 3,
      100: 3,
      200: 2,
      300: 2,
      500: 1,
      1000: 1,
    });
  });

  it('picks amount from the chosen slice only', () => {
    const picked = pickRewardSpinSlice(REWARD_SPIN_WHEEL_FACE, () => 10);
    assert.deepEqual(picked, { sliceIndex: 10, amount: 1000 });
  });

  it('rejects an out-of-range picker', () => {
    assert.throws(() => pickRewardSpinSlice(REWARD_SPIN_WHEEL_FACE, () => 12));
  });
});

describe('reward spin expiry and rate limit', () => {
  it('expires after the configured TTL', () => {
    const createdAt = new Date('2026-10-13T12:00:00.000Z');
    const expiresAt = rewardSpinExpiresAt(createdAt);
    assert.equal(expiresAt.toISOString(), '2026-10-13T12:15:00.000Z');
    assert.equal(REWARD_SPIN_TTL_MS, 15 * 60 * 1000);
    assert.equal(isRewardSpinExpired(expiresAt, new Date('2026-10-13T12:14:59.999Z')), false);
    assert.equal(isRewardSpinExpired(expiresAt, new Date('2026-10-13T12:15:00.000Z')), true);
  });

  it('rate-limits when the create window is full', () => {
    assert.equal(isRewardSpinCreateRateLimited(REWARD_SPIN_CREATE_LIMIT - 1), false);
    assert.equal(isRewardSpinCreateRateLimited(REWARD_SPIN_CREATE_LIMIT), true);
    const now = new Date('2026-10-13T12:00:00.000Z');
    assert.equal(
      rewardSpinCreateWindowStart(now).toISOString(),
      '2026-10-13T11:00:00.000Z'
    );
  });
});
