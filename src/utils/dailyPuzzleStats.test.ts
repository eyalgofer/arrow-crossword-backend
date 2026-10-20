import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dailyKeyFromDateString,
  dateStringFromDailyKey,
  last7DateStrings,
  placementsForSolves,
} from './dailyPuzzleStats';

describe('daily profile dates', () => {
  it('builds seven days oldest through today', () => {
    assert.deepEqual(last7DateStrings('2026-10-20'), [
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
    ]);
  });

  it('crosses a leap-year February', () => {
    assert.equal(last7DateStrings('2024-03-01')[0], '2024-02-24');
    assert.equal(last7DateStrings('2026-03-01')[0], '2026-02-23');
  });

  it('round-trips an assignment key', () => {
    for (const date of ['2026-01-01', '2024-02-29', '2026-10-20', '2025-12-31']) {
      const key = dailyKeyFromDateString(date);
      assert.equal(dateStringFromDailyKey(key.year, key.dayOfYear), date);
    }
  });
});

describe('daily profile placements', () => {
  const today = '2026-10-20';

  it('returns an empty week when the user has never solved a ranked daily', () => {
    const result = placementsForSolves(today, [], []);
    assert.equal(result.bestPlacement, null);
    assert.equal(result.last7.length, 7);
    assert.deepEqual(
      result.last7.map((day) => day.placement),
      [null, null, null, null, null, null, null]
    );
    assert.equal(result.last7[6].date, today);
  });

  it('ranks a sole solver first and leaves unsolved days empty', () => {
    const result = placementsForSolves(
      today,
      [{ puzzleId: 'today', bestTime: 142, dates: [today] }],
      []
    );
    assert.equal(result.bestPlacement, 1);
    assert.deepEqual(result.last7[6], { date: today, placement: 1 });
    assert.equal(result.last7[5].placement, null);
  });

  it('shares a rank on a tie and skips the next place', () => {
    const tied = placementsForSolves(
      today,
      [{ puzzleId: 'today', bestTime: 100, dates: [today] }],
      [{ puzzleId: 'today', bestTime: 100 }]
    );
    assert.equal(tied.last7[6].placement, 1);

    const passed = placementsForSolves(
      today,
      [{ puzzleId: 'today', bestTime: 100, dates: [today] }],
      [
        { puzzleId: 'today', bestTime: 90 },
        { puzzleId: 'today', bestTime: 90 },
      ]
    );
    assert.equal(passed.last7[6].placement, 3);
    assert.equal(passed.bestPlacement, 3);
  });

  it('drops a provisional first when a later solver is faster', () => {
    const before = placementsForSolves(
      today,
      [{ puzzleId: 'today', bestTime: 100, dates: [today] }],
      []
    );
    assert.equal(before.bestPlacement, 1);

    const after = placementsForSolves(
      today,
      [{ puzzleId: 'today', bestTime: 100, dates: [today] }],
      [{ puzzleId: 'today', bestTime: 70 }]
    );
    assert.equal(after.last7[6].placement, 2);
    assert.equal(after.bestPlacement, 2);
  });

  it('keeps an older first when today is no longer first', () => {
    const result = placementsForSolves(
      today,
      [
        { puzzleId: 'old', bestTime: 80, dates: ['2026-10-01'] },
        { puzzleId: 'today', bestTime: 100, dates: [today] },
      ],
      [{ puzzleId: 'today', bestTime: 70 }]
    );
    assert.equal(result.last7[6].placement, 2);
    assert.equal(result.bestPlacement, 1);
  });

  it('keeps an older best finish outside the week', () => {
    const result = placementsForSolves(
      today,
      [{ puzzleId: 'old', bestTime: 50, dates: ['2026-09-01'] }],
      []
    );
    assert.equal(result.bestPlacement, 1);
    assert.deepEqual(
      result.last7.map((day) => day.placement),
      [null, null, null, null, null, null, null]
    );
  });

  it('uses the better finish when two languages were solved the same day', () => {
    const result = placementsForSolves(
      today,
      [
        { puzzleId: 'he', bestTime: 200, dates: [today] },
        { puzzleId: 'en', bestTime: 90, dates: [today] },
      ],
      [
        { puzzleId: 'he', bestTime: 100 },
        { puzzleId: 'he', bestTime: 110 },
        { puzzleId: 'he', bestTime: 120 },
      ]
    );
    assert.equal(result.last7[6].placement, 1);
    assert.equal(result.bestPlacement, 1);
  });

  it('does not rank a solve with no time', () => {
    const result = placementsForSolves(
      today,
      [{ puzzleId: 'today', bestTime: null, dates: [today] }],
      []
    );
    assert.equal(result.bestPlacement, null);
    assert.equal(result.last7[6].placement, null);
  });
});
