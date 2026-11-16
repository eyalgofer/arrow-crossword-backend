import assert from 'node:assert/strict';
import test from 'node:test';
import { matchingStamp, reusableEtag, updatesDailyAssignment } from './playTabStamp';

test('a stored catalog etag is reused only when the request sends it', () => {
  assert.equal(reusableEtag({ etag: '"abc"' }, undefined), null);
  assert.equal(reusableEtag({ etag: '"abc"' }, '"abc"'), '"abc"');
  assert.equal(reusableEtag({ etag: '"abc"' }, '"other"'), null);
  assert.equal(reusableEtag(null, '"abc"'), null);
});

test('a progress stamp from an older catalog generation is not reused', () => {
  const stamp = { etag: '"abc"', generation: 1 };
  assert.equal(reusableEtag(stamp, '"abc"', 1), '"abc"');
  assert.equal(reusableEtag(stamp, '"abc"', 2), null);
});

test('a card stamp is reused only while every epoch it was built from is current', () => {
  const stored = { etag: '"abc"', catalog: 2, progress: 4, daily: 1, community: 3 };
  assert.equal(
    matchingStamp(stored, '"abc"', { catalog: 2, progress: 4, daily: 1, community: 3 }),
    '"abc"'
  );
  assert.equal(matchingStamp(stored, undefined, { catalog: 2, progress: 4 }), null);
  assert.equal(matchingStamp(stored, '"abc"', { catalog: 3, progress: 4 }), null);
  assert.equal(matchingStamp(stored, '"abc"', { catalog: 2, progress: 5 }), null);
  assert.equal(matchingStamp(stored, '"abc"', { catalog: 2, progress: 4, daily: 2 }), null);
  assert.equal(matchingStamp({ etag: '"abc"' }, '"abc"', { catalog: 0 }), null);
});

test('a fastest-solver update does not change the daily assignment', () => {
  assert.equal(updatesDailyAssignment({ $set: { firstSolverId: 'user', firstSolvedAt: new Date() } }), false);
  assert.equal(updatesDailyAssignment({ $set: { puzzleId: 'puzzle' } }), true);
  assert.equal(updatesDailyAssignment(null), true);
});
