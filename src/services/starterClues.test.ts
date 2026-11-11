import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FIRST_PUZZLE_STARTER_CLUE_NUMBERS,
  applyStarterClues,
  firstPackagePuzzleId,
  isFirstPackagePuzzle,
  puzzleProgressPercent,
  receivesStarterClues,
  starterClueIds,
  withStarterClues,
} from './starterClues';

const items = [
  { number: 1, direction: 'across' as const },
  { number: 3, direction: 'down' as const },
  { number: 4, direction: 'across' as const },
  { number: 64, direction: 'right-down' as const },
];

describe('first puzzle starter clues', () => {
  it('uses the clue numbers chosen for the opening board', () => {
    assert.deepEqual(
      [...FIRST_PUZZLE_STARTER_CLUE_NUMBERS],
      [3, 4, 7, 8, 10, 11, 17, 21, 28, 34, 40, 41, 44, 54, 56, 57, 64]
    );
  });

  it('turns those numbers into clue ids on the board', () => {
    assert.deepEqual(starterClueIds(items), ['3|down', '4|across', '64|right-down']);
  });

  it('keeps saved solves and adds the starter clues once', () => {
    assert.deepEqual(
      withStarterClues(['9|across', '3|down'], false, ['3|down', '4|across']),
      ['9|across', '3|down', '4|across']
    );
  });

  it('leaves a finished puzzle alone', () => {
    assert.deepEqual(
      withStarterClues(['1|across'], true, ['3|down']),
      ['1|across']
    );
  });

  it('counts starter clues toward progress', () => {
    const seeded = applyStarterClues({
      completedClueIds: ['9|across'],
      completedCluesCount: 1,
      starterIds: ['3|down', '4|across'],
    });
    assert.deepEqual(seeded.completedClueIds, ['9|across', '3|down', '4|across']);
    assert.equal(seeded.completedCluesCount, 3);
    assert.equal(puzzleProgressPercent({
      completedClueIds: [],
      totalClues: 34,
      starterIds: starterClueIds(items),
    }), 9);
  });

  it('shows full progress only after the puzzle is completed', () => {
    assert.equal(puzzleProgressPercent(undefined), 0);
    assert.equal(puzzleProgressPercent({
      completedCluesCount: 4,
      totalClues: 8,
    }), 50);
    assert.equal(puzzleProgressPercent({
      isCompleted: true,
      completedCluesCount: 1,
      totalClues: 8,
      starterIds: ['3|down'],
    }), 100);
  });

  it('treats the first slot of the first package as the opening puzzle', () => {
    const packages = [
      { language: 'en', order: 0, puzzleIds: ['en-first', 'en-second'] },
      { language: 'he', order: 0, puzzleIds: ['he-first'] },
      { language: 'he', order: 1, puzzleIds: ['he-later'] },
      { language: 'he-en', order: 0, puzzleIds: ['he-en-first'] },
      { language: null, order: 2, puzzleIds: ['legacy-en'] },
    ];
    assert.equal(isFirstPackagePuzzle('he-first', packages), true);
    assert.equal(isFirstPackagePuzzle('he-later', packages), false);
    assert.equal(isFirstPackagePuzzle('en-second', packages), false);
    assert.equal(isFirstPackagePuzzle('legacy-en', packages), false);
    assert.equal(firstPackagePuzzleId('he', packages), 'he-first');
    assert.equal(firstPackagePuzzleId('en', packages), 'en-first');
    assert.equal(receivesStarterClues('he-first', packages), true);
    assert.equal(receivesStarterClues('he-en-first', packages), true);
    assert.equal(receivesStarterClues('en-first', packages), false);
    assert.equal(receivesStarterClues('legacy-en', packages), false);
  });
});
