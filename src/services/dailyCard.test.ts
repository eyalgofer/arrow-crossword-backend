import assert from 'node:assert/strict';
import test from 'node:test';
import { toDailyCard } from './dailyCard';

test('the daily card keeps size and this player’s progress, not the crossword', () => {
  const card = toDailyCard(
    {
      _id: 'puzzle-1',
      difficulty: 'medium',
      grid: { rows: 12, cols: 10 },
    },
    { isCompleted: false, completedCluesCount: 1, totalClues: 4, bestTime: null, elapsedTime: 40 }
  );

  assert.deepEqual(card, {
    _id: 'puzzle-1',
    difficulty: 'medium',
    grid: { rows: 12, cols: 10 },
    isCompleted: false,
    isInProgress: true,
    progress: 25,
    bestTime: null,
    elapsedTime: 40,
    completedCluesCount: 1,
    totalClues: 4,
  });
  assert.equal('clues' in card, false);
});

test('a finished daily is 100 and not in progress', () => {
  const card = toDailyCard(
    { _id: 'puzzle-1', difficulty: 'easy', grid: { rows: 5, cols: 5 } },
    { isCompleted: true, completedCluesCount: 4, totalClues: 4, bestTime: 90, elapsedTime: 90 }
  );
  assert.equal(card.progress, 100);
  assert.equal(card.isCompleted, true);
  assert.equal(card.isInProgress, false);
  assert.equal(card.bestTime, 90);
});
