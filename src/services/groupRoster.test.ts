import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import mongoose from 'mongoose';
import {
  defaultGroupName,
  memberIdsExceptHost,
  memberKeyFor,
  parseOptionalGroupName,
  validateMemberIds
} from './groupRoster';

describe('saved groups', () => {
  const ownerId = new mongoose.Types.ObjectId().toString();
  const dana = new mongoose.Types.ObjectId().toString();
  const noa = new mongoose.Types.ObjectId().toString();

  it('uses the same key for the same members in any order', () => {
    assert.equal(memberKeyFor([dana, noa]), memberKeyFor([noa, dana]));
    assert.notEqual(memberKeyFor([dana]), memberKeyFor([dana, noa]));
  });

  it('builds the default name from first names', () => {
    assert.equal(defaultGroupName([
      { displayName: 'Dana Cohen' },
      { displayName: 'Noa' }
    ]), 'Dana, Noa');
    assert.equal(defaultGroupName([
      { email: 'noa@example.com' }
    ]), 'noa');
  });

  it('rejects the wrong size, duplicates, and the owner', () => {
    assert.equal(validateMemberIds([], ownerId).ok, false);
    assert.equal(validateMemberIds([dana, dana, noa, new mongoose.Types.ObjectId().toString()], ownerId).ok, false);
    assert.equal(validateMemberIds([dana, dana], ownerId).ok, false);
    assert.equal(validateMemberIds([ownerId], ownerId).ok, false);
    assert.equal(validateMemberIds(['not-an-id'], ownerId).ok, false);

    const accepted = validateMemberIds([noa, dana], ownerId);
    assert.equal(accepted.ok, true);
    if (accepted.ok) {
      assert.deepEqual(accepted.memberIds, [noa, dana]);
    }
  });

  it('drops the host from an invite list and keeps the friends', () => {
    const firebaseUid = 'firebase-host';
    assert.deepEqual(
      memberIdsExceptHost([ownerId, dana, firebaseUid], [ownerId, firebaseUid]),
      [dana]
    );
  });

  it('treats a blank name as omitted and keeps a provided name', () => {
    const omitted = parseOptionalGroupName('   ');
    assert.equal(omitted.ok, true);
    if (omitted.ok) {
      assert.equal(omitted.name, undefined);
    }
    const named = parseOptionalGroupName('  Dana, Noa  ');
    assert.equal(named.ok, true);
    if (named.ok) {
      assert.equal(named.name, 'Dana, Noa');
    }
  });
});
