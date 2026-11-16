import assert from 'node:assert/strict';
import test from 'node:test';
import { reusableEtag } from './playTabStamp';

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
