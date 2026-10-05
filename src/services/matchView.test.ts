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
      players: [
        { userId: 'user_b', displayName: 'Dana', claimedCount: 8 },
        { userId: 'user_a', displayName: 'Eyal', claimedCount: 8 },
        { userId: 'user_c', displayName: 'Noa', claimedCount: 2 }
      ]
    }, viewerId);

    assert.equal('opponent' in payload, false);
    assert.equal('opponentProgress' in payload, false);
    assert.deepEqual(payload.placements, [
      { userId: 'user_b', rank: 1, claimedCount: 8 },
      { userId: 'user_a', rank: 1, claimedCount: 8 },
      { userId: 'user_c', rank: 3, claimedCount: 2 }
    ]);
  });
});
