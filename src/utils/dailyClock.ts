/**
 * The daily puzzle follows Israel time, not the server clock.
 * ECS runs in UTC, which is 2 hours ahead of Israel in winter and 3 in summer,
 * so a UTC day boundary lands at 02:00 or 03:00 in Israel.
 * The live puzzle rolls at 12:00 noon Asia/Jerusalem, including daylight saving.
 */
export const DAILY_TIME_ZONE = 'Asia/Jerusalem';
export const DAILY_ROLLOVER_HOUR = 12;

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

interface WallClock extends CalendarDate {
  hour: number;
}

function wallClock(date: Date): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DAILY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value == null) {
      throw new Error(`Missing ${type} for ${DAILY_TIME_ZONE}`);
    }
    return Number(value);
  };

  let hour = read('hour');
  if (hour === 24) hour = 0;

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour,
  };
}

function shiftCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

/** Israel calendar date of an instant, with no rollover shift. */
export function jerusalemCalendarDate(date: Date): CalendarDate {
  const { year, month, day } = wallClock(date);
  return { year, month, day };
}

/**
 * Calendar date of the daily that is live at `date`.
 * Before 12:00 Israel time this is still yesterday.
 */
export function dailyGameDate(date: Date = new Date()): CalendarDate {
  const clock = wallClock(date);
  const calendar = { year: clock.year, month: clock.month, day: clock.day };
  if (clock.hour < DAILY_ROLLOVER_HOUR) {
    return shiftCalendarDays(calendar, -1);
  }
  return calendar;
}

/** Day of year (1–366) for a calendar date. Independent of server timezone and DST. */
export function calendarDayOfYear(date: CalendarDate): number {
  const utc = Date.UTC(date.year, date.month - 1, date.day);
  const start = Date.UTC(date.year, 0, 1);
  return Math.floor((utc - start) / 86400000) + 1;
}

/** Assignment key for a calendar date in Israel (the date the puzzle is for). */
export function calendarDailyKey(date: Date): { year: number; dayOfYear: number } {
  const calendar = jerusalemCalendarDate(date);
  return { year: calendar.year, dayOfYear: calendarDayOfYear(calendar) };
}

/** Assignment key for whichever daily is live at `date` (rolls at 12:00 Israel). */
export function liveDailyKey(date: Date = new Date()): { year: number; dayOfYear: number } {
  const game = dailyGameDate(date);
  return { year: game.year, dayOfYear: calendarDayOfYear(game) };
}

/** YYYY-MM-DD of the live daily. Streaks use the same boundary as the puzzle. */
export function dailyGameDateString(date: Date = new Date()): string {
  const { year, month, day } = dailyGameDate(date);
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}
