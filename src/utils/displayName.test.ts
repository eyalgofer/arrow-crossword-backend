import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { exactNicknameFilter } from './displayName';

describe('exact nickname search', () => {
  it('matches the whole nickname and not a prefix', () => {
    const filter = exactNicknameFilter('  Dana  ');
    const pattern = filter.$or[1].displayName as RegExp;
    assert.equal(filter.$or[0].displayNameKey, 'dana');
    assert.equal(pattern.test('Dana'), true);
    assert.equal(pattern.test('dana'), true);
    assert.equal(pattern.test('Dan'), false);
    assert.equal(pattern.test('Dana Cohen'), false);
    assert.equal(pattern.test('xDana'), false);
  });
});
