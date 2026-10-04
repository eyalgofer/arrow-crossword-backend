import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildReplaySchedule, buildSolverSchedule, solverPaceFromSeed } from './ghostSchedule';

const MINUTE = 60_000;
const MATCH_MS = 10 * MINUTE;

describe('buildReplaySchedule', () => {
  it('replays a finish that landed inside the match window', () => {
    const started = new Date('2026-01-01T00:00:00.000Z');
    const events = buildReplaySchedule({
      startedAt: started,
      endedAt: new Date(started.getTime() + MATCH_MS),
      playerCompletedAt: new Date(started.getTime() + 2 * MINUTE),
      finalProgress: 100,
      moves: [
        { row: 1, col: 2, letter: 'A', timestamp: new Date(started.getTime() + 30_000) },
        { row: 1, col: 3, letter: 'B', timestamp: new Date(started.getTime() + 60_000) }
      ]
    }, MATCH_MS);

    const finish = events.find(event => event.type === 'finish');
    assert.equal(finish?.atMs, 2 * MINUTE);
    assert.equal(events.filter(event => event.type === 'move').length, 2);
    const lastProgress = [...events].reverse().find(event => event.type === 'progress');
    assert.equal(lastProgress?.progress, 100);
    assert.ok((finish?.atMs ?? 0) >= (lastProgress?.atMs ?? 0));
  });

  it('scales progress when the source player was slower than this match', () => {
    const started = new Date('2026-01-01T00:00:00.000Z');
    const events = buildReplaySchedule({
      startedAt: started,
      endedAt: new Date(started.getTime() + 15 * MINUTE),
      playerCompletedAt: new Date(started.getTime() + 15 * MINUTE),
      finalProgress: 100,
      moves: [
        { row: 0, col: 0, letter: 'Z', timestamp: new Date(started.getTime() + 12 * MINUTE) }
      ]
    }, MATCH_MS);

    assert.equal(events.some(event => event.type === 'finish'), false);
    assert.equal(events.some(event => event.type === 'move'), false);
    const atEnd = events.filter(event => event.type === 'progress' && event.atMs === MATCH_MS);
    assert.equal(atEnd.at(-1)?.progress, 67);
  });

  it('keeps a partial game inside the window and does not finish it', () => {
    const started = new Date('2026-01-01T00:00:00.000Z');
    const events = buildReplaySchedule({
      startedAt: started,
      endedAt: new Date(started.getTime() + MATCH_MS),
      finalProgress: 40,
      moves: [
        { row: 2, col: 2, letter: 'C', timestamp: new Date(started.getTime() + 20_000) },
        { row: 2, col: 3, letter: 'D', timestamp: new Date(started.getTime() + MATCH_MS + 5_000) }
      ]
    }, MATCH_MS);

    assert.equal(events.some(event => event.type === 'finish'), false);
    assert.deepEqual(
      events.filter(event => event.type === 'move').map(event => event.letter),
      ['C']
    );
    const progress = events.filter(event => event.type === 'progress');
    assert.equal(progress.at(-1)?.progress, 40);
    assert.ok((progress.at(-1)?.atMs ?? 0) <= MATCH_MS);
    assert.ok(progress.every(event => (event.atMs ?? 0) <= MATCH_MS));
  });
});

describe('buildSolverSchedule', () => {
  it('is deterministic for a seed', () => {
    assert.deepEqual(buildSolverSchedule(MATCH_MS, 7), buildSolverSchedule(MATCH_MS, 7));
  });

  it('finishes only when the pace fits in the match', () => {
    const finishingSeed = findSeed(pace => pace <= 1);
    const slowSeed = findSeed(pace => pace > 1);

    const fast = buildSolverSchedule(MATCH_MS, finishingSeed);
    const slow = buildSolverSchedule(MATCH_MS, slowSeed);

    assert.equal(fast.some(event => event.type === 'finish'), true);
    assert.equal(fast.some(event => event.type === 'progress' && event.progress === 100), true);
    assert.equal(slow.some(event => event.type === 'finish'), false);
    const slowProgress = slow.filter(event => event.type === 'progress').map(event => event.progress ?? 0);
    assert.ok(Math.max(...slowProgress) < 100);
    assert.ok(Math.max(...slowProgress) > 0);
  });
});

function findSeed(predicate: (pace: number) => boolean): number {
  for (let seed = 1; seed < 500; seed++) {
    if (predicate(solverPaceFromSeed(seed))) {
      return seed;
    }
  }
  throw new Error('no seed matched');
}
