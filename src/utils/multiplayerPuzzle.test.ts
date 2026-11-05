import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseLeastExposed, choosePuzzleId, poolLanguage, variedPool } from './multiplayerPuzzle';

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

test('a Hebrew puzzle stays in the Hebrew pool when its slot was saved as English', () => {
  assert.equal(poolLanguage('he', 'en'), 'he');
  assert.equal(poolLanguage('en', 'he'), 'he');
  assert.equal(poolLanguage(undefined, 'he'), 'he');
  assert.equal(poolLanguage(undefined, undefined), 'en');
  assert.equal(poolLanguage('en', undefined), 'en');
});

test('a recent image is skipped while another linked board is eligible', () => {
  const images = new Map<string, readonly string[]>([
    ['seen', ['ריהאנה', 'ביגבן']],
    ['fresh', ['טוקיו', 'אדירמילר']],
    ['other', ['גלגדות']],
  ]);
  const pool = variedPool(['seen', 'fresh', 'other'], new Set(['seen']), images);
  assert.deepEqual(pool, ['fresh', 'other']);
});

test('boards stay eligible when every one repeats a recent image', () => {
  const images = new Map<string, readonly string[]>([
    ['seen', ['ריהאנה']],
    ['again', ['ריהאנה']],
  ]);
  const pool = variedPool(['seen', 'again'], new Set(['seen']), images);
  assert.deepEqual(pool, ['again']);
});

test('an unseen board is chosen over one that shares a seen image', () => {
  const images = new Map<string, readonly string[]>([
    ['tokyo', ['טוקיו']],
    ['fresh', ['סידני']],
  ]);
  const picked = chooseLeastExposed(
    ['tokyo', 'fresh'],
    images,
    new Map(),
    new Map([['טוקיו', 100]]),
    () => 0
  );
  assert.equal(picked, 'fresh');
});

test('when every board shares a seen image, the least recently exposed one is chosen', () => {
  const images = new Map<string, readonly string[]>([
    ['newer', ['טוקיו', 'סידני']],
    ['older', ['טוקיו']],
  ]);
  const picked = chooseLeastExposed(
    ['newer', 'older'],
    images,
    new Map([['newer', 80]]),
    new Map([
      ['טוקיו', 50],
      ['סידני', 200],
    ]),
    () => 0
  );
  assert.equal(picked, 'older');
});

test('ties among equally fresh boards stay uniform', () => {
  const ids = ['a', 'b', 'c'];
  const images = new Map<string, readonly string[]>(ids.map(id => [id, [id]]));
  assert.equal(chooseLeastExposed(ids, images, new Map(), new Map(), () => 0), 'a');
  assert.equal(chooseLeastExposed(ids, images, new Map(), new Map(), () => 0.34), 'b');
  assert.equal(chooseLeastExposed(ids, images, new Map(), new Map(), () => 0.999), 'c');
});
