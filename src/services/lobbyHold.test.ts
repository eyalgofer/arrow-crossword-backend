import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { firstActiveHold, LOBBY_HOLD_MS, seatHoldActive } from './lobbyHold';

describe('lobby ad hold', () => {
  const now = 1_000_000;
  const seat = {
    userId: { toString: () => 'user-1' },
    status: 'joined' as const,
    holdStartedAt: new Date(now - 1_000)
  };

  it('blocks start while a joined seat is inside the ad', () => {
    assert.equal(seatHoldActive(seat, now), true);
    assert.equal(firstActiveHold([seat], now)?.userId.toString(), 'user-1');
  });

  it('drops a hold once it is 90 seconds old', () => {
    const stale = { ...seat, holdStartedAt: new Date(now - LOBBY_HOLD_MS) };
    assert.equal(seatHoldActive(stale, now), false);
    assert.equal(firstActiveHold([stale], now), undefined);
  });

  it('ignores a seat that is not in the match', () => {
    assert.equal(seatHoldActive({ ...seat, status: 'invited' }, now), false);
    assert.equal(seatHoldActive({ ...seat, holdStartedAt: null }, now), false);
  });
});
