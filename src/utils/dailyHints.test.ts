import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DAILY_HINT_LIMIT, LETTER_HINT_COST, WORD_HINT_COST } from '../constants/daily';
import { deriveDailyPuzzleStatsFromProgress } from './dailyPuzzleStats';
import { countsTowardFastestTime, decideHintPurchase } from './dailyHints';

describe('daily hint purchase', () => {
  it('charges a letter or a word as one hint on today\'s daily', () => {
    const letter = decideHintPurchase({
      isTodaysDaily: true,
      hintsUsed: 0,
      coins: 120,
      cost: LETTER_HINT_COST,
    });
    assert.equal(letter.kind, 'purchase');
    if (letter.kind !== 'purchase') return;
    assert.deepEqual(letter.body, {
      coins: 115,
      hintsUsed: 1,
      hintsRemaining: 2,
      hintLimit: DAILY_HINT_LIMIT,
    });

    const word = decideHintPurchase({
      isTodaysDaily: true,
      hintsUsed: 1,
      coins: 115,
      cost: WORD_HINT_COST,
    });
    assert.equal(word.kind, 'purchase');
    if (word.kind !== 'purchase') return;
    assert.equal(word.nextHintsUsed, 2);
    assert.equal(word.body.coins, 100);
  });

  it('rejects the fourth hint without charging', () => {
    const decision = decideHintPurchase({
      isTodaysDaily: true,
      hintsUsed: DAILY_HINT_LIMIT,
      coins: 4,
      cost: LETTER_HINT_COST,
    });
    assert.equal(decision.kind, 'limit');
    if (decision.kind !== 'limit') return;
    assert.deepEqual(decision.body, {
      code: 'daily_hint_limit',
      hintsUsed: 3,
      hintLimit: 3,
      coins: 4,
    });
  });

  it('does not consume a hint when the balance is too low', () => {
    const decision = decideHintPurchase({
      isTodaysDaily: true,
      hintsUsed: 1,
      coins: 4,
      cost: LETTER_HINT_COST,
    });
    assert.equal(decision.kind, 'insufficient');
  });

  it('does not cap or count hints on other puzzles', () => {
    const decision = decideHintPurchase({
      isTodaysDaily: false,
      hintsUsed: 3,
      coins: 20,
      cost: WORD_HINT_COST,
    });
    assert.equal(decision.kind, 'purchase');
    if (decision.kind !== 'purchase') return;
    assert.equal(decision.incrementHints, false);
    assert.equal(decision.nextHintsUsed, 3);
    assert.deepEqual(decision.body, { coins: 5 });
  });
});

describe('fastest time and stored hints', () => {
  it('counts a solve only when the stored counter is still zero', () => {
    assert.equal(countsTowardFastestTime(0), true);
    assert.equal(countsTowardFastestTime(undefined), true);
    assert.equal(countsTowardFastestTime(null), true);
    assert.equal(countsTowardFastestTime(1), false);
  });

  it('ignores hinted best times when deriving lifetime fastest', () => {
    const stats = deriveDailyPuzzleStatsFromProgress([
      { bestTime: 40, lastPlayedAt: new Date('2026-10-05T12:00:00'), hintsUsed: 2 },
      { bestTime: 90, lastPlayedAt: new Date('2026-10-06T12:00:00'), hintsUsed: 0 },
    ], '2026-10-06');
    assert.equal(stats.solvedCount, 2);
    assert.equal(stats.fastestSeconds, 90);
  });
});
