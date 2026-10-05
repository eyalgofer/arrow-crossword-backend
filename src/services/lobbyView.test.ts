import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import mongoose from 'mongoose';
import { clientUserId, mongoKey } from './lobbyView';

describe('lobby player ids', () => {
  it('reads an ObjectId without following its _id back into itself', () => {
    const id = new mongoose.Types.ObjectId();
    assert.equal(mongoKey(id), id.toString());
    assert.equal(mongoKey({ _id: id }), id.toString());
    assert.equal(
      clientUserId(id, new Map([[id.toString(), 'firebase-host']])),
      'firebase-host'
    );
  });
});
