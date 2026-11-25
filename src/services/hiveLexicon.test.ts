import assert from 'node:assert/strict';
import test from 'node:test';
import { HIVE_CENTER_SHARE, HIVE_MAX_ANSWERS, HIVE_MIN_ANSWERS, HIVE_SHORT_SHARE } from '../utils/hive';
import { buildHives, playableWords, sortedHives } from './hiveLexicon';
test('a dictionary word is playable even when it is not one of the crossword answers that picked the hive', () => {
  const played = playableWords('ו', ['א', 'ב', 'ע', 'צ', 'ת', 'כ']);
  assert.equal(played.answers.includes('צוותא'), true);
  assert.ok(played.answers.length > 18);
  assert.ok(played.maxScore > 0);
});

test('a common four-letter answer can join a hive and a rare one cannot', () => {
  const hives = buildHives([
    { answer: 'אבגד', fillScore: 3 },
    { answer: 'נדיר', fillScore: 2 },
  ]);
  assert.equal(hives.length, 0);
});

test('the clue file yields a stable list of easy-to-medium hives', () => {
  const hives = sortedHives();
  assert.ok(hives.length > 50);
  assert.deepEqual(sortedHives(), hives);
  for (let index = 1; index < hives.length; index += 1) {
    assert.ok(hives[index - 1].id < hives[index].id);
  }
  for (const hive of hives) {
    assert.equal(hive.outer.length, 6);
    assert.equal(hive.outer.includes(hive.center), false);
    assert.ok(hive.answers.length >= HIVE_MIN_ANSWERS && hive.answers.length <= HIVE_MAX_ANSWERS);
    const short = hive.answers.filter((word) => [...word].length <= 5).length;
    const long = hive.answers.filter((word) => [...word].length >= 6).length;
    assert.ok(short / hive.answers.length >= HIVE_SHORT_SHARE);
    assert.ok(long >= 1);
    const withCenter = hive.answers.filter((word) => word.includes(hive.center)).length;
    assert.ok(withCenter / hive.answers.length >= HIVE_CENTER_SHARE);
    assert.equal(hive.answers.join(), [...hive.answers].sort().join());
  }
});
