import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { settlePrize } from './prizeSettlement';
import { decidePrizePlay, parseMatchStake, parseRandomStake } from '../utils/stakes';

const duel = [
  { userId: 'user_a', rank: 1 },
  { userId: 'user_b', rank: 2 }
];

describe('match stakes', () => {
  it('treats a missing invite or lobby stake as friendly', () => {
    assert.deepEqual(parseMatchStake(undefined), { ok: true, stake: 0 });
    assert.deepEqual(parseMatchStake(null), { ok: true, stake: 0 });
    assert.deepEqual(parseMatchStake(''), { ok: true, stake: 0 });
  });

  it('accepts 0, 100, and 250 and rejects anything else', () => {
    assert.deepEqual(parseMatchStake(0), { ok: true, stake: 0 });
    assert.deepEqual(parseMatchStake(100), { ok: true, stake: 100 });
    assert.deepEqual(parseMatchStake(250), { ok: true, stake: 250 });
    assert.deepEqual(parseMatchStake('100'), { ok: true, stake: 100 });
    assert.equal(parseMatchStake(50).ok, false);
    assert.equal(parseMatchStake(75).ok, false);
  });

  it('lets an old random search omit stake and still requires 100 when stake is sent', () => {
    assert.deepEqual(parseRandomStake(undefined), { ok: true, stake: 0 });
    assert.deepEqual(parseRandomStake(100), { ok: true, stake: 100 });
    assert.equal(parseRandomStake(0).ok, false);
    assert.equal(parseRandomStake(250).ok, false);
    assert.equal(parseRandomStake('100').ok, false);
  });

  it('escrows only when every player opted into a positive stake', () => {
    assert.deepEqual(decidePrizePlay({ stake: 100, optedIn: [true, true] }), {
      stake: 100,
      escrow: true
    });
  });

  it('downgrades a prize stake when anyone did not opt in', () => {
    assert.deepEqual(decidePrizePlay({ stake: 100, optedIn: [true, false] }), {
      stake: 0,
      escrow: false,
      stakeDowngraded: true
    });
  });

  it('keeps an opted-in stake of 0 friendly, with no downgrade flag', () => {
    assert.deepEqual(decidePrizePlay({ stake: 0, optedIn: [true, true] }), {
      stake: 0,
      escrow: false
    });
    assert.equal('stakeDowngraded' in decidePrizePlay({ stake: 0, optedIn: [false, false] }), false);
  });
});

describe('prize settlement', () => {
  it('pays nothing for a friendly match', () => {
    const result = settlePrize({
      kind: 'duel',
      stake: 0,
      opponentKind: 'live',
      reason: 'timeout',
      winnerId: 'user_a',
      players: duel
    });
    assert.equal(result.pot, 0);
    assert.deepEqual(result.settlement.map(row => row.coinsDelta), [0, 0]);
  });

  it('pays the duel winner 200 and the loser 0', () => {
    const result = settlePrize({
      kind: 'duel',
      stake: 100,
      opponentKind: 'live',
      reason: 'completed',
      winnerId: 'user_b',
      players: duel
    });
    assert.equal(result.pot, 200);
    assert.deepEqual(result.settlement, [
      { userId: 'user_a', coinsDelta: 0 },
      { userId: 'user_b', coinsDelta: 200 }
    ]);
  });

  it('refunds both stakes on a draw', () => {
    const result = settlePrize({
      kind: 'duel',
      stake: 100,
      opponentKind: 'live',
      reason: 'timeout',
      winnerId: null,
      players: [
        { userId: 'user_a', rank: 1, boost: 100 },
        { userId: 'user_b', rank: 1 }
      ]
    });
    assert.deepEqual(result.settlement, [
      { userId: 'user_a', coinsDelta: 200 },
      { userId: 'user_b', coinsDelta: 100 }
    ]);
  });

  it('pays the player who stayed the full escrow on a forfeit', () => {
    const result = settlePrize({
      kind: 'duel',
      stake: 100,
      opponentKind: 'live',
      reason: 'forfeit',
      winnerId: 'user_a',
      players: [
        { userId: 'user_a', rank: 1, boost: 100 },
        { userId: 'user_b', rank: 2, left: true }
      ]
    });
    assert.deepEqual(result.settlement.map(row => row.coinsDelta), [300, 0]);
  });

  it('pays 200 and 100 in a 4-player match and leaves 100 unpaid', () => {
    const result = settlePrize({
      kind: 'group',
      stake: 100,
      opponentKind: 'live',
      reason: 'timeout',
      players: [
        { userId: 'user_a', rank: 1 },
        { userId: 'user_b', rank: 2 },
        { userId: 'user_c', rank: 3 },
        { userId: 'user_d', rank: 4 }
      ]
    });
    assert.equal(result.pot, 200);
    assert.deepEqual(result.settlement.map(row => row.coinsDelta), [200, 100, 0, 0]);
    const paid = result.settlement.reduce((sum, row) => sum + row.coinsDelta, 0);
    assert.equal(paid, 300);
  });

  it('pays nothing against a replay or solver', () => {
    const result = settlePrize({
      kind: 'duel',
      stake: 100,
      opponentKind: 'solver',
      reason: 'completed',
      winnerId: 'user_a',
      players: [{ userId: 'user_a', rank: 1 }]
    });
    assert.equal(result.stake, 0);
    assert.equal(result.pot, 0);
    assert.deepEqual(result.settlement, [{ userId: 'user_a', coinsDelta: 0 }]);
  });

  it('returns the same deltas when settlement is calculated again', () => {
    const input = {
      kind: 'group' as const,
      stake: 100,
      opponentKind: 'live' as const,
      reason: 'board_completed',
      players: [
        { userId: 'user_a', rank: 1 },
        { userId: 'user_b', rank: 2 },
        { userId: 'user_c', rank: 3 }
      ]
    };
    assert.deepEqual(settlePrize(input), settlePrize(input));
    assert.deepEqual(settlePrize(input).settlement.map(row => row.coinsDelta), [200, 100, 0]);
  });

  it('splits a group draw across the players who share first', () => {
    const result = settlePrize({
      kind: 'group',
      stake: 100,
      reason: 'timeout',
      players: [
        { userId: 'user_a', rank: 1 },
        { userId: 'user_b', rank: 1 },
        { userId: 'user_c', rank: 3 }
      ]
    });
    assert.deepEqual(result.settlement.map(row => row.coinsDelta), [150, 150, 0]);
  });

  it('gives the last remaining player the whole escrow on a forfeit', () => {
    const result = settlePrize({
      kind: 'group',
      stake: 100,
      reason: 'forfeit',
      players: [
        { userId: 'user_a', rank: 1 },
        { userId: 'user_b', rank: 2, left: true },
        { userId: 'user_c', rank: 3, left: true }
      ]
    });
    assert.deepEqual(result.settlement.map(row => row.coinsDelta), [300, 0, 0]);
  });
});
