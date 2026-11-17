import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyGuess,
  classifyGuess,
  disablesFiveLetterWord,
  emptyFiveLetterRound,
  fiveLetterDayNumber,
  fiveLetterHourNumber,
  isFiveLetterWord,
  markGuess,
  normalizeFiveWord,
  pickFiveLetterWord,
  recordSolve,
  toFiveLetterCard,
  toFiveLetterRoundView,
  wholeSeconds,
} from './fiveLetters';

describe('five letter words', () => {
  it('folds a final letter onto the regular letter', () => {
    assert.equal(normalizeFiveWord('שלומם'), 'שלוממ');
    assert.equal(isFiveLetterWord('שלומם'), true);
    assert.deepEqual(markGuess('שלומם', 'שלוממ'), [
      'correct', 'correct', 'correct', 'correct', 'correct',
    ]);
  });

  it('spends a right-place letter before the copies that follow it', () => {
    assert.deepEqual(markGuess('ממממב', 'מגניב'), [
      'correct', 'absent', 'absent', 'absent', 'correct',
    ]);
  });

  it('claims leftover copies from the first letter toward the last', () => {
    assert.deepEqual(markGuess('בבבכש', 'כלבלב'), [
      'present', 'absent', 'correct', 'present', 'absent',
    ]);
  });

  it('rejects a guess that is not five Hebrew letters', () => {
    assert.deepEqual(classifyGuess('מגני'), { ok: false, reason: 'wrong_length' });
    assert.deepEqual(classifyGuess('abcde'), { ok: false, reason: 'wrong_length' });
    assert.deepEqual(classifyGuess(''), { ok: false, reason: 'wrong_length' });
    assert.deepEqual(classifyGuess(5), { ok: false, reason: 'wrong_length' });
    assert.deepEqual(classifyGuess('מגניב'), { ok: true, word: 'מגניב' });
    assert.equal(markGuess('מגני', 'מגניב'), null);
  });

  it('keeps only a finite timer of zero or more seconds', () => {
    assert.equal(wholeSeconds(40.8), 40);
    assert.equal(wholeSeconds(0), 0);
    assert.equal(wholeSeconds(-1), null);
    assert.equal(wholeSeconds(Number.NaN), null);
    assert.equal(wholeSeconds('40'), null);
  });

  it('counts Israel midnights from 2026-01-01', () => {
    assert.equal(fiveLetterDayNumber({ year: 2026, month: 1, day: 1 }), 0);
    assert.equal(fiveLetterDayNumber({ year: 2026, month: 1, day: 2 }), 1);
    assert.equal(fiveLetterDayNumber({ year: 2026, month: 11, day: 17 }), 320);
    assert.equal(fiveLetterDayNumber({ year: 2025, month: 12, day: 31 }), -1);
  });

  it('counts Israel hours from 2026-01-01 00:00', () => {
    assert.equal(fiveLetterHourNumber(new Date('2025-12-31T22:00:00.000Z')), 0);
    assert.equal(fiveLetterHourNumber(new Date('2025-12-31T23:00:00.000Z')), 1);
    assert.equal(fiveLetterHourNumber(new Date('2026-11-17T10:00:00.000Z')), 320 * 24 + 12);
  });

  it('uses one word every day until a second word is enabled', () => {
    const only = [{ word: 'מגניב', _id: 'a' }];
    assert.equal(pickFiveLetterWord(only, 0)?.word, 'מגניב');
    assert.equal(pickFiveLetterWord(only, 320)?.word, 'מגניב');
    assert.equal(pickFiveLetterWord([], 0), null);
  });

  it('sorts by the word, then id, and the next day is a different word', () => {
    const tied = [
      { word: 'מגניב', _id: 'b' },
      { word: 'מגניב', _id: 'a' },
    ];
    assert.equal(pickFiveLetterWord(tied, 0)?._id, 'a');
    assert.equal(pickFiveLetterWord(tied, 1)?._id, 'b');

    const words = [
      { word: 'מגניב', _id: 'b' },
      { word: 'בבבבב', _id: 'c' },
      { word: 'שלוממ', _id: 'a' },
    ];
    assert.equal(pickFiveLetterWord(words, 0)?.word, 'בבבבב');
    assert.equal(pickFiveLetterWord(words, 1)?.word, 'מגניב');
    assert.equal(pickFiveLetterWord(words, 2)?.word, 'שלוממ');
    assert.equal(pickFiveLetterWord(words, 3)?.word, 'בבבבב');
    assert.notEqual(pickFiveLetterWord(words, 4)?.word, pickFiveLetterWord(words, 5)?.word);
  });

  it('closes a round that is already finished or full', () => {
    const won = applyGuess(
      { ...emptyFiveLetterRound(), status: 'won', guesses: [{ word: 'מגניב', marks: ['correct', 'correct', 'correct', 'correct', 'correct'] }] },
      'שלוממ',
      'מגניב',
      10
    );
    assert.deepEqual(won, { ok: false, reason: 'round_closed' });

    const full = applyGuess(
      {
        ...emptyFiveLetterRound(),
        guesses: Array.from({ length: 5 }, () => ({
          word: 'שלוממ',
          marks: ['absent', 'absent', 'absent', 'absent', 'absent'] as const,
        })),
      },
      'מגניב',
      'מגניב',
      10
    );
    assert.equal(full.ok, false);
  });

  it('wins on the fifth guess when that guess is the word', () => {
    let round = emptyFiveLetterRound();
    for (let i = 0; i < 4; i += 1) {
      const next = applyGuess(round, 'שלוממ', 'מגניב', 10);
      assert.equal(next.ok, true);
      if (!next.ok) return;
      round = next.round;
    }
    const last = applyGuess(round, 'מגניב', 'מגניב', 30);
    assert.equal(last.ok, true);
    if (!last.ok) return;
    assert.equal(last.wonNow, true);
    assert.equal(last.round.status, 'won');
    assert.equal(last.round.guesses.length, 5);
    assert.equal(last.round.completionSeconds, 30);
  });

  it('wins on the answer and loses on the fifth miss', () => {
    const first = applyGuess(emptyFiveLetterRound(), 'שלוממ', 'מגניב', 40);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.wonNow, false);
    assert.equal(first.round.status, 'playing');
    assert.equal(first.round.elapsedSeconds, 40);
    assert.equal(first.round.completionSeconds, null);

    const winning = applyGuess(first.round, 'מגניב', 'מגניב', 55);
    assert.equal(winning.ok, true);
    if (!winning.ok) return;
    assert.equal(winning.wonNow, true);
    assert.equal(winning.round.status, 'won');
    assert.equal(winning.round.completionSeconds, 55);

    let round = emptyFiveLetterRound();
    for (let i = 0; i < 4; i += 1) {
      const next = applyGuess(round, 'שלוממ', 'מגניב', 10 + i);
      assert.equal(next.ok, true);
      if (!next.ok) return;
      round = next.round;
      assert.equal(round.status, 'playing');
    }
    const last = applyGuess(round, 'שלוממ', 'מגניב', 20);
    assert.equal(last.ok, true);
    if (!last.ok) return;
    assert.equal(last.wonNow, false);
    assert.equal(last.round.status, 'lost');
    assert.equal(last.round.completionSeconds, null);
  });

  it('keeps a missing timer off the community record', () => {
    const win = applyGuess(emptyFiveLetterRound(), 'מגניב', 'מגניב', null);
    assert.equal(win.ok, true);
    if (!win.ok) return;
    assert.equal(win.round.completionSeconds, null);
    assert.equal(win.round.elapsedSeconds, null);
  });

  it('treats enabled:false as disabling the assigned word', () => {
    assert.equal(disablesFiveLetterWord({ enabled: false }), true);
    assert.equal(disablesFiveLetterWord({ $set: { enabled: false } }), true);
    assert.equal(disablesFiveLetterWord({ $unset: { enabled: 1 } }), true);
    assert.equal(disablesFiveLetterWord([{ $set: { enabled: false } }]), true);
    assert.equal(disablesFiveLetterWord({ $set: { enabled: true } }), false);
    assert.equal(disablesFiveLetterWord({ $set: { word: 'אבגדה' } }), false);
    assert.equal(disablesFiveLetterWord(null), false);
  });

  it('counts a solve once and only replaces a strictly faster time', () => {
    assert.deepEqual(recordSolve({ solvedCount: 0, fastestSeconds: null }, 18), {
      solvedCount: 1,
      fastestSeconds: 18,
    });
    assert.deepEqual(recordSolve({ solvedCount: 1, fastestSeconds: 18 }, 18), {
      solvedCount: 2,
      fastestSeconds: 18,
    });
    assert.deepEqual(recordSolve({ solvedCount: 2, fastestSeconds: 18 }, 10), {
      solvedCount: 3,
      fastestSeconds: 10,
    });
    assert.deepEqual(recordSolve({ solvedCount: 3, fastestSeconds: 10 }, null), {
      solvedCount: 4,
      fastestSeconds: 10,
    });
    assert.deepEqual(recordSolve({ solvedCount: 0, fastestSeconds: null }, 0), {
      solvedCount: 1,
      fastestSeconds: 0,
    });
  });

  it('describes a player who has not opened the round', () => {
    assert.deepEqual(toFiveLetterCard(null), {
      status: 'playing',
      guessCount: 0,
      bestTime: null,
      elapsedSeconds: null,
    });
  });

  it('hides the answer until the round is lost', () => {
    const playing = toFiveLetterRoundView({
      date: '2026-11-17',
      endsAt: '2026-11-17T22:00:00.000Z',
      answer: 'מגניב',
      round: null,
      solvedCount: 12,
      fastestSeconds: 18,
    });
    assert.equal(playing.answer, undefined);
    assert.equal(playing.entryPaid, false);
    assert.equal(playing.elapsedSeconds, 0);
    assert.equal(playing.roundId, '2026-11-17');
    assert.equal('answer' in playing, false);

    const won = applyGuess(emptyFiveLetterRound(), 'מגניב', 'מגניב', 55);
    assert.equal(won.ok, true);
    if (!won.ok) return;
    const wonView = toFiveLetterRoundView({
      date: '2026-11-17',
      endsAt: '2026-11-17T22:00:00.000Z',
      answer: 'מגניב',
      round: won.round,
      solvedCount: 1,
      fastestSeconds: 55,
    });
    assert.equal(wonView.answer, undefined);
    assert.equal(wonView.bestTime, 55);
    assert.equal(toFiveLetterCard(won.round).bestTime, 55);

    let round = emptyFiveLetterRound();
    for (let i = 0; i < 5; i += 1) {
      const next = applyGuess(round, 'שלוממ', 'מגניב', 8);
      assert.equal(next.ok, true);
      if (!next.ok) return;
      round = next.round;
    }
    const lost = toFiveLetterRoundView({
      date: '2026-11-17',
      endsAt: '2026-11-17T22:00:00.000Z',
      answer: 'מגניב',
      round,
      solvedCount: 12,
      fastestSeconds: 18,
    });
    assert.equal(lost.status, 'lost');
    assert.equal(lost.answer, 'מגניב');
    assert.equal(lost.bestTime, null);
    assert.equal(toFiveLetterCard(round).bestTime, null);
  });
});
