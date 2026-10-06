import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clueDifficultyMeanOk,
  clueMixOk,
  meanChosenClueDifficulty,
  PACKAGE_CLUE_WEIGHTS,
  sampleClueDifficulty,
} from './puzzle-assembler';

describe('package clue difficulty mix', () => {
  it('samples buckets from the cumulative weights', () => {
    const easy = PACKAGE_CLUE_WEIGHTS.easy;
    assert.equal(sampleClueDifficulty(easy, () => 0), 1);
    assert.equal(sampleClueDifficulty(easy, () => 0.69), 1);
    assert.equal(sampleClueDifficulty(easy, () => 0.7), 2);
    assert.equal(sampleClueDifficulty(easy, () => 0.94), 2);
    assert.equal(sampleClueDifficulty(easy, () => 0.95), 3);

    const hard = PACKAGE_CLUE_WEIGHTS.hard;
    assert.equal(sampleClueDifficulty(hard, () => 0), 1);
    assert.equal(sampleClueDifficulty(hard, () => 0.2), 2);
    assert.equal(sampleClueDifficulty(hard, () => 0.55), 3);
  });

  it('accepts a mean only when it matches the package label', () => {
    assert.equal(clueDifficultyMeanOk('easy', 1.6), true);
    assert.equal(clueDifficultyMeanOk('easy', 1.61), false);
    assert.equal(clueDifficultyMeanOk('medium', 1.55), true);
    assert.equal(clueDifficultyMeanOk('medium', 1.54), false);
    assert.equal(clueDifficultyMeanOk('medium', 2.25), true);
    assert.equal(clueDifficultyMeanOk('medium', 2.26), false);
    assert.equal(clueDifficultyMeanOk('hard', 2.15), true);
    assert.equal(clueDifficultyMeanOk('hard', 2.14), false);
    assert.equal(clueMixOk('hard', 2.4, 0.1), true);
    assert.equal(clueMixOk('hard', 3, 0), false);
    assert.equal(clueMixOk('easy', 1.2, 0), true);
  });

  it('averages matched text clues and skips image clues', () => {
    const lookup = (answer: string) =>
      answer === 'אב'
        ? [
            { text: 'מבני המשפחה', difficulty: 1 },
            { text: 'הורה זכר', difficulty: 3 },
          ]
        : [{ text: 'עיר', difficulty: 2 }];
    const mean = meanChosenClueDifficulty(
      [
        { clue: 'מבני המשפחה', answer: 'אב', clueType: 'text' },
        { clue: 'עיר', answer: 'עיר', clueType: 'text' },
        { clue: 'IMAGE', answer: 'חתול', clueType: 'image' },
      ],
      lookup
    );
    assert.equal(mean, 1.5);
    assert.equal(meanChosenClueDifficulty([{ clue: 'אין', answer: 'אין' }], () => []), null);
  });
});
