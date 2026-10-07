import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calendarDayOfYear,
  dailyGameDateString,
  jerusalemCalendarDate,
  liveDailyKey,
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
});
