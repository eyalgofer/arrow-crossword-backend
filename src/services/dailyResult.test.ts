import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { competitionRank, shouldClaimFastestPrize } from './dailyResult';

describe('dailyResult helpers', () => {
  it('competitionRank uses 1-based place with ties sharing (1, 1, 3)', () => {
    assert.equal(competitionRank(0), 1);
    assert.equal(competitionRank(0), 1); // two with zero faster → both rank 1
    assert.equal(competitionRank(2), 3); // two tied ahead → next is 3
  });

  it('shouldClaimFastestPrize takes first set and only strictly faster times', () => {
    assert.equal(shouldClaimFastestPrize(null, 120), true);
    assert.equal(shouldClaimFastestPrize(undefined, 120), true);
    assert.equal(shouldClaimFastestPrize(120, 119), true);
    assert.equal(shouldClaimFastestPrize(120, 120), false);
    assert.equal(shouldClaimFastestPrize(120, 121), false);
    assert.equal(shouldClaimFastestPrize(null, 0), false);
    assert.equal(shouldClaimFastestPrize(null, -1), false);
  });
});
