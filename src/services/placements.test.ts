import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import mongoose from 'mongoose';
import {
  buildPlacements,
  groupLeaveEndsMatch,
  placementsForMatch,
  rosterState,
  winnerIdFromPlacements
} from './placements';

describe('group placements', () => {
  const players = [
    { userId: 'user_b', claimedCount: 8 },
    { userId: 'user_a', claimedCount: 5 },
    { userId: 'user_c', claimedCount: 2 }
  ];

  it('ranks by claimed count and gives the sole leader rank 1', () => {
    assert.deepEqual(buildPlacements(players), [
      { userId: 'user_b', rank: 1, claimedCount: 8 },
      { userId: 'user_a', rank: 2, claimedCount: 5 },
      { userId: 'user_c', rank: 3, claimedCount: 2 }
    ]);
    assert.equal(winnerIdFromPlacements(players), 'user_b');
  });

  it('shares rank 1 when two players tie and leaves winner unset', () => {
    const tied = [
      { userId: 'user_b', claimedCount: 8 },
      { userId: 'user_a', claimedCount: 8 },
      { userId: 'user_c', claimedCount: 2 }
    ];
    assert.deepEqual(buildPlacements(tied), [
      { userId: 'user_b', rank: 1, claimedCount: 8 },
      { userId: 'user_a', rank: 1, claimedCount: 8 },
      { userId: 'user_c', rank: 3, claimedCount: 2 }
    ]);
    assert.equal(winnerIdFromPlacements(tied), null);
  });

  it('ranks a player who left last even with more claims', () => {
    const withLeaver = [
      { userId: 'user_b', claimedCount: 4, left: false },
      { userId: 'user_a', claimedCount: 2, left: false },
      { userId: 'user_c', claimedCount: 9, left: true }
    ];
    assert.deepEqual(buildPlacements(withLeaver), [
      { userId: 'user_b', rank: 1, claimedCount: 4 },
      { userId: 'user_a', rank: 2, claimedCount: 2 },
      { userId: 'user_c', rank: 3, claimedCount: 9 }
    ]);
    assert.equal(winnerIdFromPlacements(withLeaver), 'user_b');
  });

  it('gives the last remaining player the win after everyone else leaves', () => {
    const lastStanding = [
      { userId: 'user_a', claimedCount: 1, left: false },
      { userId: 'user_b', claimedCount: 10, left: true },
      { userId: 'user_c', claimedCount: 8, left: true }
    ];
    assert.equal(winnerIdFromPlacements(lastStanding), 'user_a');
    assert.equal(buildPlacements(lastStanding)[0].rank, 1);
    assert.equal(groupLeaveEndsMatch(1), true);
    assert.equal(groupLeaveEndsMatch(2), false);
  });

  it('omits placements for a duel', () => {
    assert.equal(placementsForMatch('duel', players), undefined);
    assert.equal(placementsForMatch(undefined, players), undefined);
    assert.deepEqual(placementsForMatch('group', players)?.map(row => row.rank), [1, 2, 3]);
  });

  it('reads a Mongoose ObjectId without looping on its _id', () => {
    const id = new mongoose.Types.ObjectId();
    assert.deepEqual(buildPlacements([{ userId: id, claimedCount: 1 }]), [
      { userId: id.toString(), rank: 1, claimedCount: 1 }
    ]);
  });

  it('ranks a normal game by progress and keeps a sole leader', () => {
    const filled = [
      { userId: 'user_b', claimedCount: 0, progress: 40 },
      { userId: 'user_a', claimedCount: 0, progress: 80 },
      { userId: 'user_c', claimedCount: 0, progress: 10 }
    ];
    assert.deepEqual(buildPlacements(filled, 'normal'), [
      { userId: 'user_a', rank: 1, claimedCount: 0 },
      { userId: 'user_b', rank: 2, claimedCount: 0 },
      { userId: 'user_c', rank: 3, claimedCount: 0 }
    ]);
    assert.equal(winnerIdFromPlacements(filled, 'normal'), 'user_a');
  });

  it('keeps ranking a normal game by progress when a claim count is also present', () => {
    const filled = [
      { userId: 'user_b', claimedCount: 9, progress: 20 },
      { userId: 'user_a', claimedCount: 1, progress: 70 }
    ];
    assert.equal(winnerIdFromPlacements(filled, 'normal'), 'user_a');
  });

  it('falls back to progress when a quick game has no claims', () => {
    const filled = [
      { userId: 'user_b', claimedCount: 0, progress: 25 },
      { userId: 'user_a', claimedCount: 0, progress: 60 }
    ];
    assert.equal(winnerIdFromPlacements(filled, 'quick'), 'user_a');
    assert.equal(buildPlacements(filled, 'quick')[0].userId, 'user_a');
  });

  it('treats a leaver as no longer playing', () => {
    const roster = [
      { userId: { toString: () => 'user_a' }, left: false },
      { userId: { toString: () => 'user_b' }, left: true }
    ];
    assert.equal(rosterState(roster, 'user_a'), 'playing');
    assert.equal(rosterState(roster, 'user_b'), 'left');
    assert.equal(rosterState(roster, 'user_c'), 'absent');
  });
});
