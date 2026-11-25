import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyHiveGuess,
  hiveMaskOf,
  hiveRank,
  hiveWordScore,
  keepPinnedHive,
  letterMask,
  pickHive,
  qualifyHive,
  type HivePuzzle,
} from './hive';

const LETTERS = 'אבגדהוז';
const MASK = letterMask(LETTERS)!;

function easyHiveWords(): string[] {
  const extras = ['ב', 'ג', 'ד', 'ה', 'ו', 'ז'];
  const words = ['אבגדהו'];
  let count = 0;
  for (const left of extras) {
    for (const right of extras) {
      if (count >= 17) return words;
      words.push(`א${left}א${right}`);
      count += 1;
    }
  }
  return words;
}

function puzzle(words: readonly string[]): HivePuzzle {
  return {
    center: 'א',
    hiveMask: MASK,
    answers: new Set(words),
  };
}

describe('hive scoring', () => {
  it('scores 1 for four letters and 1 more for each extra letter', () => {
    assert.equal(hiveWordScore('אבאב', MASK), 1);
    assert.equal(hiveWordScore('אבגדה', MASK), 2);
    assert.equal(hiveWordScore('אבגדהו', MASK), 3);
  });

  it('adds 7 when the word uses every hive letter', () => {
    assert.equal(hiveWordScore('אבגדהוז', MASK), 11);
    assert.equal(hiveWordScore('אבגדהוזא', MASK), 12);
  });

  it('names ranks from the share of the day’s max score', () => {
    assert.equal(hiveRank(0, 100), 'beginner');
    assert.equal(hiveRank(9, 100), 'beginner');
    assert.equal(hiveRank(10, 100), 'moving');
    assert.equal(hiveRank(25, 100), 'nice');
    assert.equal(hiveRank(45, 100), 'great');
    assert.equal(hiveRank(69, 100), 'great');
    assert.equal(hiveRank(70, 100), 'genius');
  });
});

describe('hive filter', () => {
  it('accepts an easy-to-medium letter set and puts the common letter in the center', () => {
    const hive = qualifyHive(easyHiveWords(), MASK);
    assert.ok(hive);
    assert.equal(hive.center, 'א');
    assert.equal(hive.outer.length, 6);
    assert.ok(hive.answers.length >= 18 && hive.answers.length <= 36);
    assert.ok(hive.maxScore > 0);
    assert.deepEqual(hive.answers, [...hive.answers].sort());
  });

  it('rejects a set with fewer than 18 answers', () => {
    const words = easyHiveWords().slice(0, 17);
    assert.equal(qualifyHive(words, MASK), null);
  });

  it('rejects a set with no word of 6 or more letters', () => {
    const words = easyHiveWords().filter((word) => word.length < 6);
    while (words.length < 18) words.push(`אבאב${words.length}`);
    assert.equal(qualifyHive(words.slice(0, 20), MASK), null);
  });

  it('rejects a set where under 70% of the words are 4 or 5 letters', () => {
    const words = ['אבגדהו', 'אבגדהז', 'אבגדהה', 'אבגדהד', 'אבגדהג', 'אבגדהב', 'אבדהוז', 'אבגהוז', 'אבדההז', 'אבדההב'];
    const shorts = easyHiveWords().filter((word) => word.length <= 5).slice(0, 8);
    assert.equal(qualifyHive([...words, ...shorts], MASK), null);
  });

  it('rejects a hive whose busiest letter is in under half the answers', () => {
    const letters = [...LETTERS];
    const pairs: string[] = [];
    for (let left = 0; left < letters.length; left += 1) {
      for (let right = left + 1; right < letters.length; right += 1) {
        const a = letters[left];
        const b = letters[right];
        pairs.push(a + b + a + b);
      }
    }
    const spread = ['אבגדהו', ...pairs.slice(0, 18)];
    assert.equal(new Set(spread).size, spread.length);
    assert.equal(qualifyHive(spread, MASK), null);
  });
});

describe('hive day pin', () => {
  it('keeps the pinned hive when a later generation would pick another', () => {
    const pinned = keepPinnedHive({ id: 'pinned' }, { id: 'generated' });
    const generated = keepPinnedHive(null, { id: 'generated' });
    assert.ok(pinned);
    assert.equal(pinned.id, 'pinned');
    assert.ok(generated);
    assert.equal(generated.id, 'generated');
    assert.equal(keepPinnedHive(null, null), null);
  });

  it('walks the sorted list by Israel day and wraps', () => {
    const hives = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    assert.equal(pickHive(hives, 0)?.id, 'a');
    assert.equal(pickHive(hives, 1)?.id, 'b');
    assert.equal(pickHive(hives, 3)?.id, 'a');
    assert.equal(pickHive(hives, -1)?.id, 'c');
    assert.equal(pickHive([], 0), null);
  });
});

describe('hive guesses', () => {
  const words = easyHiveWords();
  const live = puzzle(words);

  it('accepts an answer and folds a final letter', () => {
    const answer = words.find((word) => word.length === 4)!;
    const guess = classifyHiveGuess(`  ${answer}  `, live, new Set());
    assert.deepEqual(guess, { ok: true, word: answer, score: hiveWordScore(answer, MASK) });

    const folded: HivePuzzle = {
      center: 'א',
      hiveMask: letterMask('אבגדהוכ')!,
      answers: new Set(['אבגכ']),
    };
    assert.deepEqual(classifyHiveGuess('אבגך', folded, new Set()), {
      ok: true,
      word: 'אבגכ',
      score: 1,
    });
  });

  it('rejects each bad guess', () => {
    const answer = words.find((word) => word.length === 4)!;
    const outside = 'אבגדט';
    assert.equal(letterMask('ט') != null, true);
    assert.deepEqual(classifyHiveGuess('אבג', live, new Set()), { ok: false, reason: 'too_short' });
    assert.deepEqual(classifyHiveGuess(5, live, new Set()), { ok: false, reason: 'too_short' });
    assert.deepEqual(classifyHiveGuess(outside, live, new Set()), { ok: false, reason: 'bad_letters' });
    assert.deepEqual(classifyHiveGuess('בגבג', live, new Set()), { ok: false, reason: 'missing_center' });
    assert.deepEqual(classifyHiveGuess('אבאא', live, new Set()), { ok: false, reason: 'not_a_word' });
    assert.deepEqual(classifyHiveGuess(answer, live, new Set([answer])), { ok: false, reason: 'already_found' });
    assert.deepEqual(classifyHiveGuess(answer, live, new Set(words)), { ok: false, reason: 'day_closed' });
  });

  it('builds a mask from the center and the six outer letters', () => {
    assert.equal(hiveMaskOf('א', ['ב', 'ג', 'ד', 'ה', 'ו', 'ז']), MASK);
  });
});
