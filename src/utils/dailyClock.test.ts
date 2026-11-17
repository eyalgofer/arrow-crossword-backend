import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calendarDayOfYear,
  dailyGameDateString,
  isAtOrAfterJerusalemHour,
  isBeforeLiveDailyKey,
  jerusalemCalendarDate,
  liveDailyKey,
  isBeforeLiveJerusalemHour,
  jerusalemHourKey,
  nextJerusalemHour,
  nextJerusalemMidnight,
} from './dailyClock';

describe('daily clock', () => {
  it('rolls at midnight Israel time in summer (UTC+3)', () => {
    const beforeMidnight = new Date('2026-10-05T20:59:00.000Z'); // 23:59 IDT
    const atMidnight = new Date('2026-10-05T21:00:00.000Z'); // 00:00 IDT Oct 6

    assert.equal(dailyGameDateString(beforeMidnight), '2026-10-05');
    assert.equal(dailyGameDateString(atMidnight), '2026-10-06');
    assert.deepEqual(liveDailyKey(atMidnight), {
      year: 2026,
      dayOfYear: calendarDayOfYear({ year: 2026, month: 10, day: 6 }),
    });
  });

  it('rolls at midnight Israel time in winter (UTC+2)', () => {
    const beforeMidnight = new Date('2026-11-30T21:59:00.000Z'); // 23:59 IST
    const atMidnight = new Date('2026-11-30T22:00:00.000Z'); // 00:00 IST Dec 1

    assert.equal(dailyGameDateString(beforeMidnight), '2026-11-30');
    assert.equal(dailyGameDateString(atMidnight), '2026-12-01');
  });

  it('rolls the year at midnight on January 1, not at UTC midnight', () => {
    const beforeMidnight = new Date('2025-12-31T21:59:00.000Z'); // 23:59 IST
    const atMidnight = new Date('2025-12-31T22:00:00.000Z'); // 00:00 IST Jan 1

    assert.equal(dailyGameDateString(beforeMidnight), '2025-12-31');
    assert.deepEqual(liveDailyKey(beforeMidnight), { year: 2025, dayOfYear: 365 });
    assert.deepEqual(liveDailyKey(atMidnight), { year: 2026, dayOfYear: 1 });
  });

  it('stays on today through the morning, including the old noon boundary', () => {
    const morning = new Date('2026-10-06T05:48:00.000Z'); // 08:48 IDT
    const noon = new Date('2026-10-06T09:00:00.000Z'); // 12:00 IDT

    assert.equal(dailyGameDateString(morning), '2026-10-06');
    assert.equal(dailyGameDateString(noon), '2026-10-06');
  });

  it('uses the Israel calendar date for assignments, including across the UTC offset', () => {
    // 21:00 UTC on Oct 5 is midnight at the start of Oct 6 in Israel (UTC+3).
    const israelMidnight = new Date('2026-10-05T21:00:00.000Z');
    assert.deepEqual(jerusalemCalendarDate(israelMidnight), {
      year: 2026,
      month: 10,
      day: 6,
    });
    assert.equal(
      calendarDayOfYear(jerusalemCalendarDate(israelMidnight)),
      279
    );
  });

  it('gates the morning push at 09:00 Israel time', () => {
    // 08:59 IDT (UTC+3)
    const beforeNine = new Date('2026-10-06T05:59:00.000Z');
    // 09:00 IDT
    const atNine = new Date('2026-10-06T06:00:00.000Z');

    assert.equal(isAtOrAfterJerusalemHour(9, beforeNine), false);
    assert.equal(isAtOrAfterJerusalemHour(9, atNine), true);
  });

  it('marks prior calendar days as before the live daily key', () => {
    const afterMidnight = new Date('2026-10-05T21:00:00.000Z'); // 00:00 IDT Oct 6
    const live = liveDailyKey(afterMidnight);

    assert.equal(isBeforeLiveDailyKey(live.year, live.dayOfYear, afterMidnight), false);
    assert.equal(isBeforeLiveDailyKey(live.year, live.dayOfYear - 1, afterMidnight), true);
    assert.equal(isBeforeLiveDailyKey(2025, 365, afterMidnight), true);
  });

  it('ends the Israel day at the next Jerusalem midnight', () => {
    // Winter, UTC+2. Nov 17 ends at Nov 18 00:00 IST = Nov 17 22:00 UTC.
    assert.equal(
      nextJerusalemMidnight(new Date('2026-11-17T10:00:00.000Z')).toISOString(),
      '2026-11-17T22:00:00.000Z'
    );
    assert.equal(
      nextJerusalemMidnight(new Date('2026-11-17T21:59:00.000Z')).toISOString(),
      '2026-11-17T22:00:00.000Z'
    );
    assert.equal(
      nextJerusalemMidnight(new Date('2026-11-17T22:00:00.000Z')).toISOString(),
      '2026-11-18T22:00:00.000Z'
    );

    // Summer, UTC+3. Oct 5 ends at Oct 6 00:00 IDT = Oct 5 21:00 UTC.
    assert.equal(
      nextJerusalemMidnight(new Date('2026-10-05T12:00:00.000Z')).toISOString(),
      '2026-10-05T21:00:00.000Z'
    );
    assert.equal(
      nextJerusalemMidnight(new Date('2026-10-05T20:59:00.000Z')).toISOString(),
      '2026-10-05T21:00:00.000Z'
    );
    assert.equal(
      nextJerusalemMidnight(new Date('2026-10-05T21:00:00.000Z')).toISOString(),
      '2026-10-06T21:00:00.000Z'
    );
  });

  it('ends the five-letter word at the next Israel hour', () => {
    // Winter, UTC+2. 12:30 IST is 10:30 UTC. The next hour is 13:00 IST.
    const during = new Date('2026-11-17T10:30:00.000Z');
    assert.equal(jerusalemHourKey(during), '2026-11-17T12');
    assert.equal(nextJerusalemHour(during).toISOString(), '2026-11-17T11:00:00.000Z');

    // 23:30 IST rolls to the next midnight.
    const late = new Date('2026-11-17T21:30:00.000Z');
    assert.equal(jerusalemHourKey(late), '2026-11-17T23');
    assert.equal(nextJerusalemHour(late).toISOString(), '2026-11-17T22:00:00.000Z');
    assert.equal(jerusalemHourKey(nextJerusalemHour(late)), '2026-11-18T00');

    // Summer, UTC+3. 15:15 IDT is 12:15 UTC. The next hour is 16:00 IDT.
    const summer = new Date('2026-10-05T12:15:00.000Z');
    assert.equal(jerusalemHourKey(summer), '2026-10-05T15');
    assert.equal(nextJerusalemHour(summer).toISOString(), '2026-10-05T13:00:00.000Z');
  });

  it('treats only an earlier hour key as closed', () => {
    const now = new Date('2026-11-17T10:30:00.000Z');
    assert.equal(isBeforeLiveJerusalemHour('2026-11-17T11', now), true);
    assert.equal(isBeforeLiveJerusalemHour('2026-11-17T12', now), false);
    assert.equal(isBeforeLiveJerusalemHour('2026-11-17T13', now), false);
    assert.equal(isBeforeLiveJerusalemHour('2026-11-17', now), false);
  });
});
