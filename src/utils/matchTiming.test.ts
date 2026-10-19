import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isMatchTimedOut, withMatchTiming } from './matchTiming';

describe('match clock', () => {
  it('does not run the clock before a player has joined', () => {
    const createdAt = new Date(Date.now() - 60_000);
    const match = { timed: true, durationSeconds: 180, createdAt };
    assert.equal(isMatchTimedOut(match), false);
    const view = withMatchTiming(match);
    assert.equal('startedAt' in view, false);
    assert.equal(view.endsAt, null);
  });
});