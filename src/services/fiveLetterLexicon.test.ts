import assert from 'node:assert/strict';
import test from 'node:test';
import { isRealFiveLetterWord, sortedFiveLetterWords } from './fiveLetterLexicon';

test('a real five-letter Hebrew word is accepted, including a final letter', () => {
  assert.equal(isRealFiveLetterWord('אבטחה'), true);
  assert.equal(isRealFiveLetterWord('אגמונ'), true);
  assert.equal(isRealFiveLetterWord('אגמון'), true);
});

test('a dictionary word with a clitic prefix is accepted', () => {
  assert.equal(isRealFiveLetterWord('בבוקר'), true);
  assert.equal(isRealFiveLetterWord('והבית'), true);
  assert.equal(isRealFiveLetterWord('הלכתי'), true);
});

test('the lexicon is a stable sorted list of five-letter words', () => {
  const words = sortedFiveLetterWords();
  assert.ok(words.length > 1000);
  assert.equal(words.includes('אבטחה'), true);
  for (let i = 1; i < words.length; i += 1) {
    assert.ok(words[i - 1] < words[i]);
  }
  assert.deepEqual(sortedFiveLetterWords(), words);
});

test('a five-letter string that is not a word is rejected', () => {
  assert.equal(isRealFiveLetterWord('אאאאא'), false);
  assert.equal(isRealFiveLetterWord('גגגגג'), false);
  assert.equal(isRealFiveLetterWord('מגני'), false);
});
