import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calendarDayOfYear,
  dailyGameDateString,
  jerusalemCalendarDate,
  liveDailyKey,
} from './dailyClock';

describe('daily clock', () => {
  it('keeps yesterday until 12:00 Israel time in summer (UTC+3)', () => {
    const beforeNoon = new Date('2026-10-06T08:59:00.000Z'); // 11:59 IDT
    const atNoon = new Date('2026-10-06T09:00:00.000Z'); // 12:00 IDT

    assert.equal(dailyGameDateString(beforeNoon), '2026-10-05');
    assert.equal(dailyGameDateString(atNoon), '2026-10-06');
    assert.deepEqual(liveDailyKey(atNoon), {
      year: 2026,
      dayOfYear: calendarDayOfYear({ year: 2026, month: 10, day: 6 }),
    });
  });

  it('keeps yesterday until 12:00 Israel time in winter (UTC+2)', () => {
    const beforeNoon = new Date('2026-12-01T09:59:00.000Z'); // 11:59 IST
    const atNoon = new Date('2026-12-01T10:00:00.000Z'); // 12:00 IST

    assert.equal(dailyGameDateString(beforeNoon), '2026-11-30');
    assert.equal(dailyGameDateString(atNoon), '2026-12-01');
  });

  it('rolls the year at noon on January 1, not at UTC midnight', () => {
    const beforeNoon = new Date('2026-01-01T09:59:00.000Z'); // 11:59 IST
    const atNoon = new Date('2026-01-01T10:00:00.000Z'); // 12:00 IST

    assert.equal(dailyGameDateString(beforeNoon), '2025-12-31');
    assert.deepEqual(liveDailyKey(beforeNoon), { year: 2025, dayOfYear: 365 });
    assert.deepEqual(liveDailyKey(atNoon), { year: 2026, dayOfYear: 1 });
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
});
