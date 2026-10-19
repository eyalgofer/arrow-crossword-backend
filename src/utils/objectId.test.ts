import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { toObjectId } from './objectId';

test('a mongoose ObjectId resolves without walking its _id getter', () => {
  const id = new mongoose.Types.ObjectId();
  assert.equal(toObjectId(id)?.toString(), id.toString());
});

test('a populated document resolves through a distinct _id', () => {
  const id = new mongoose.Types.ObjectId();
  assert.equal(toObjectId({ _id: id, name: 'player' })?.toString(), id.toString());
});

test('an id whose _id is itself does not recurse', () => {
  const id = new mongoose.Types.ObjectId();
  const cycle: { _id?: unknown; toString: () => string } = {
    toString: () => id.toString(),
  };
  Object.defineProperty(cycle, '_id', {
    enumerable: true,
    get() {
      return cycle;
    },
  });
  assert.equal(toObjectId(cycle)?.toString(), id.toString());
});
