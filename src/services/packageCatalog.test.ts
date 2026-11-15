import assert from 'node:assert/strict';
import test from 'node:test';
import { entityTag } from '../utils/conditionalGet';
import {
  buildPackageProgress,
  catalogEtagSource,
  progressEtagSource,
  puzzleRingSummaries,
  withRingDifficulties,
} from './packageCatalog';

const puzzleA = 'a'.repeat(24);
const puzzleB = 'b'.repeat(24);
const packageId = 'c'.repeat(24);

const packages = [{
  _id: packageId,
  name: 'Getting Started',
  description: 'Perfect for beginners',
  theme: 'Basics',
  language: 'he',
  puzzleCount: 2,
  puzzleIds: [puzzleA, puzzleB],
  order: 0,
  iconName: 'leaf',
  gradientColors: ['#10B981', '#059669'],
}];

test('ring summaries follow puzzleIds and keep every difficulty', () => {
  const summaries = puzzleRingSummaries(
    [puzzleB, puzzleA],
    new Map([[puzzleA, 'expert'], [puzzleB, 'challenging']])
  );
  assert.deepEqual(summaries, [
    { id: puzzleB, difficulty: 'challenging' },
    { id: puzzleA, difficulty: 'expert' },
  ]);
  assert.deepEqual(Object.keys(summaries[0]).sort(), ['difficulty', 'id']);
});

test('an unknown difficulty is left off so the ring can fall back', () => {
  assert.deepEqual(
    puzzleRingSummaries([puzzleA], new Map([[puzzleA, 'boss']])),
    [{ id: puzzleA }]
  );
});

test('package JSON keeps the fields already in production and adds ring color', () => {
  const [pkg] = withRingDifficulties(packages, new Map([[puzzleA, 'easy'], [puzzleB, 'medium']]));
  assert.equal(pkg.name, 'Getting Started');
  assert.equal(pkg.theme, 'Basics');
  assert.equal(pkg.puzzleCount, 2);
  assert.deepEqual(pkg.puzzleIds, [puzzleA, puzzleB]);
  assert.equal(pkg.order, 0);
  assert.equal(pkg.iconName, 'leaf');
  assert.deepEqual(pkg.gradientColors, ['#10B981', '#059669']);
  assert.deepEqual(pkg.puzzles, [
    { id: puzzleA, difficulty: 'easy' },
    { id: puzzleB, difficulty: 'medium' },
  ]);
  assert.equal('grid' in pkg.puzzles[0], false);
  assert.equal('answer' in pkg.puzzles[0], false);
  assert.equal('clue' in pkg.puzzles[0], false);
});

test('catalog etags differ by language and by ring difficulty', () => {
  const easy = new Map<string, string>([[puzzleA, 'easy'], [puzzleB, 'medium']]);
  const he = entityTag(catalogEtagSource('he', packages, easy));
  assert.equal(he, entityTag(catalogEtagSource('he', packages, easy)));
  assert.notEqual(he, entityTag(catalogEtagSource('en', packages, easy)));
  assert.notEqual(he, entityTag(catalogEtagSource('he-en', packages, easy)));
  assert.notEqual(
    he,
    entityTag(catalogEtagSource('he', packages, new Map([[puzzleA, 'hard'], [puzzleB, 'medium']])))
  );
  assert.notEqual(
    he,
    entityTag(catalogEtagSource('he', [{ ...packages[0], name: 'Word Play' }], easy))
  );
});

test('progress rows stay puzzleId, progress, and lastPlayedAt', () => {
  const playedAt = new Date('2024-01-15T12:00:00.000Z');
  const earlier = new Date('2024-01-10T10:00:00.000Z');
  const body = buildPackageProgress({
    packages,
    headStart: { puzzleId: puzzleA, starterIds: ['3|down', '4|across'], totalClues: 4 },
    progressDocs: [
      {
        puzzleId: puzzleB,
        isCompleted: true,
        completedCluesCount: 4,
        totalClues: 4,
        lastPlayedAt: playedAt,
      },
      {
        puzzleId: puzzleA,
        isCompleted: false,
        completedClueIds: ['9|across'],
        completedCluesCount: 1,
        totalClues: 4,
        lastPlayedAt: earlier,
      },
    ],
  });

  assert.equal(body.totalCompletedPuzzles, 1);
  assert.equal(body.progress[0].packageId, packageId);
  assert.equal(body.progress[0].completedCount, 1);
  assert.equal(body.progress[0].isCompleted, false);
  assert.equal(body.progress[0].lastPlayedAt, playedAt);
  assert.equal(body.progress[0].puzzles[0].puzzleId, puzzleA);
  assert.equal(body.progress[0].puzzles[0].progress, 75);
  assert.equal(body.progress[0].puzzles[1].progress, 100);
  assert.deepEqual(Object.keys(body.progress[0].puzzles[0]).sort(), [
    'lastPlayedAt',
    'progress',
    'puzzleId',
  ]);
  assert.equal('difficulty' in body.progress[0].puzzles[0], false);
});

test('an untouched opening puzzle still counts its starter clues', () => {
  const body = buildPackageProgress({
    packages: [{ _id: packageId, puzzleIds: [puzzleA] }],
    headStart: { puzzleId: puzzleA, starterIds: ['3|down', '4|across'], totalClues: 4 },
    progressDocs: [],
  });
  assert.equal(body.progress[0].puzzles[0].progress, 50);
  assert.equal(body.progress[0].completedCount, 0);
  assert.equal('lastPlayedAt' in body.progress[0], false);
});

test('progress etags are per user and per language', () => {
  const source = {
    packages,
    headStart: null,
    progressDocs: [{
      puzzleId: puzzleA,
      completedClueIds: ['2|down', '1|across'],
      completedCluesCount: 2,
      totalClues: 4,
      lastPlayedAt: new Date('2024-01-15T12:00:00.000Z'),
    }],
  };
  const he = entityTag(progressEtagSource({ userId: 'user-a', language: 'he', ...source }));
  assert.equal(he, entityTag(progressEtagSource({ userId: 'user-a', language: 'he', ...source })));
  assert.notEqual(he, entityTag(progressEtagSource({ userId: 'user-b', language: 'he', ...source })));
  assert.notEqual(he, entityTag(progressEtagSource({ userId: 'user-a', language: 'en', ...source })));
  assert.notEqual(he, entityTag(progressEtagSource({ userId: 'user-a', language: 'he-en', ...source })));

  const reordered = progressEtagSource({
    userId: 'user-a',
    language: 'he',
    packages,
    headStart: null,
    progressDocs: [{
      ...source.progressDocs[0],
      completedClueIds: ['1|across', '2|down'],
    }],
  });
  assert.equal(he, entityTag(reordered));

  const played = progressEtagSource({
    userId: 'user-a',
    language: 'he',
    packages,
    headStart: null,
    progressDocs: [{ ...source.progressDocs[0], completedCluesCount: 3 }],
  });
  assert.notEqual(he, entityTag(played));
});

test('only the unfinished opening puzzle clue ids change the progress etag', () => {
  const headStart = { puzzleId: puzzleA, starterIds: ['3|down'], totalClues: 4 };
  const base = {
    userId: 'user-a',
    language: 'he',
    packages,
    headStart,
    progressDocs: [
      {
        puzzleId: puzzleB,
        isCompleted: false,
        completedClueIds: ['1|across'],
        completedCluesCount: 1,
        totalClues: 4,
      },
      {
        puzzleId: puzzleA,
        isCompleted: false,
        completedClueIds: ['9|across'],
        completedCluesCount: 1,
        totalClues: 4,
      },
    ],
  };
  const tag = entityTag(progressEtagSource(base));
  assert.equal(tag, entityTag(progressEtagSource({
    ...base,
    progressDocs: [
      { ...base.progressDocs[0], completedClueIds: ['2|down', '8|across'] },
      base.progressDocs[1],
    ],
  })));
  assert.notEqual(tag, entityTag(progressEtagSource({
    ...base,
    progressDocs: [
      base.progressDocs[0],
      { ...base.progressDocs[1], completedClueIds: ['9|across', '3|down'] },
    ],
  })));
});
