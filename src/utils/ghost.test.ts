import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import mongoose from 'mongoose';
import { GHOST_OPPONENT_ID } from '../constants/match';
import { isGhostOpponentId, resolvePlayerId } from './ghost';

describe('ghost opponent id', () => {
  const ghostId = new mongoose.Types.ObjectId(GHOST_OPPONENT_ID);
  const humanId = new mongoose.Types.ObjectId();

  it('recognizes a raw ObjectId without following its _id forever', () => {
    assert.equal(isGhostOpponentId(ghostId), true);
    assert.equal(isGhostOpponentId(humanId), false);
    assert.equal(resolvePlayerId(ghostId), GHOST_OPPONENT_ID);
    assert.equal(resolvePlayerId(humanId), humanId.toString());
  });

  it('reads a populated user document once', () => {
    assert.equal(isGhostOpponentId({ _id: ghostId, displayName: 'תשחצן_247' }), true);
    assert.equal(isGhostOpponentId({ _id: humanId, displayName: 'eyal' }), false);
    assert.equal(resolvePlayerId({ _id: humanId }), humanId.toString());
  });

  it('keeps the reserved id when a ghost user failed to populate', () => {
    assert.equal(resolvePlayerId(null, 'solver'), GHOST_OPPONENT_ID);
    assert.equal(resolvePlayerId(null, 'live'), '');
  });
});
