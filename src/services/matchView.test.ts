import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyMatchReadFields } from './matchView';

describe('match read payload', () => {
  const viewerId = 'user_a';

  it('keeps a duel opponent and does not add placements', () => {
    const payload = applyMatchReadFields({
      opponent: { userId: 'user_b', displayName: 'Dana' },
      players: []
    }, {
      kind: 'duel',
      status: 'completed',
      players: [
        { userId: 'user_a', displayName: 'Eyal', claimedCount: 1 },
        { userId: 'user_b', displayName: 'Dana', claimedCount: 2 }
      ]
    }, viewerId);

    assert.equal(payload.kind, 'duel');
    assert.equal('placements' in payload, false);
    assert.equal('groupId' in payload, false);
    assert.deepEqual(payload.opponent, { userId: 'user_b', displayName: 'Dana' });
  });

  it('adds players and opponent for a two-player group match', () => {
    const payload = applyMatchReadFields({ players: [] }, {
      kind: 'group',
      groupId: 'group_1',
      status: 'in_progress',
      players: [
        { userId: 'user_a', displayName: 'Eyal', claimedCount: 1 },
        { userId: 'user_b', displayName: 'Dana', photoURL: null, claimedCount: 4 }
      ]
    }, viewerId);

    assert.equal(payload.kind, 'group');
    assert.equal(payload.groupId, 'group_1');
    assert.equal('placements' in payload, false);
    const opponent = payload.opponent as { userId: string; displayName: string };
    assert.equal(opponent.userId, 'user_b');
    assert.equal(opponent.displayName, 'Dana');
    assert.equal((payload.players as { userId: string }[]).length, 2);
  });

  it('omits opponent when a group match has more than two players and ranks a finished match', () => {
    const payload = applyMatchReadFields({
      opponent: { userId: 'user_b' },
      opponentProgress: 10
    }, {
      kind: 'group',
      status: 'completed',
      mode: 'quick',
      players: [
        { userId: 'user_b', displayName: 'Dana', claimedCount: 8 },
        { userId: 'user_a', displayName: 'Eyal', claimedCount: 8 },
        { userId: 'user_c', displayName: 'Noa', claimedCount: 2 }
      ]
    }, viewerId);

    assert.equal('opponent' in payload, false);
    assert.equal('opponentProgress' in payload, false);
    assert.equal('stake' in payload, false);
    assert.equal('pot' in payload, false);
    assert.deepEqual(payload.placements, [
      { userId: 'user_b', rank: 1, claimedCount: 8 },
      { userId: 'user_a', rank: 1, claimedCount: 8 },
      { userId: 'user_c', rank: 3, claimedCount: 2 }
    ]);
  });

  it('ranks a finished normal group by board progress when nobody claimed a word', () => {
    const payload = applyMatchReadFields({}, {
      kind: 'group',
      status: 'completed',
      mode: 'normal',
      players: [
        { userId: 'user_b', displayName: 'Dana', claimedCount: 0, progress: 40 },
        { userId: 'user_a', displayName: 'Eyal', claimedCount: 0, progress: 80 },
        { userId: 'user_c', displayName: 'Noa', claimedCount: 0, progress: 10 }
      ]
    }, viewerId);

    assert.deepEqual(payload.placements, [
      { userId: 'user_a', rank: 1, claimedCount: 0 },
      { userId: 'user_b', rank: 2, claimedCount: 0 },
      { userId: 'user_c', rank: 3, claimedCount: 0 }
    ]);
  });

  it('puts the first-place pot on a prize match', () => {
    const payload = applyMatchReadFields({
      opponentProgress: 30,
      stake: 100,
      pot: 0,
      boosts: [{ amount: 100 }]
    }, {
      kind: 'duel',
      status: 'in_progress',
      players: [
        { userId: 'user_a', displayName: 'Eyal', claimedCount: 1 },
        { userId: 'user_b', displayName: 'Dana', claimedCount: 2 }
      ]
    }, viewerId);

    assert.equal(payload.stake, 100);
    assert.equal(payload.pot, 300);
  });

  it('omits stake and pot on a friendly match', () => {
    const payload = applyMatchReadFields({
      opponentProgress: 30,
      stake: 0,
      pot: 0
    }, {
      kind: 'duel',
      status: 'in_progress',
      players: [
        { userId: 'user_a', displayName: 'Eyal', claimedCount: 1 },
        { userId: 'user_b', displayName: 'Dana', claimedCount: 2 }
      ]
    }, viewerId);

    assert.equal('stake' in payload, false);
    assert.equal('pot' in payload, false);
  });
});
