import assert from 'node:assert/strict';
import test from 'node:test';
import { choosePuzzleId } from './multiplayerPuzzle';

test('an empty pool picks nothing', () => {
  assert.equal(choosePuzzleId([], new Set()), null);
});

test('recent boards are skipped while another board is eligible', () => {
  const picked = choosePuzzleId(['old', 'fresh', 'also-old'], new Set(['old', 'also-old']), () => 0);
  assert.equal(picked, 'fresh');
});

test('the pick is uniform across the eligible boards', () => {
  const ids = ['a', 'b', 'c'];
  assert.equal(choosePuzzleId(ids, new Set(), () => 0), 'a');
  assert.equal(choosePuzzleId(ids, new Set(), () => 0.34), 'b');
  assert.equal(choosePuzzleId(ids, new Set(), () => 0.999), 'c');
});

test('when every board was just played, one of them is still returned', () => {
  const picked = choosePuzzleId(['a', 'b'], new Set(['a', 'b']), () => 0.9);
  assert.equal(picked, 'b');
});
