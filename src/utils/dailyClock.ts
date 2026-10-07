/**
 * The daily puzzle follows the Israel calendar date, not the server clock.
 * ECS runs in UTC. Israel is UTC+2 in winter and UTC+3 in summer, so a UTC
 * midnight lands at 02:00 or 03:00 in Israel. The live puzzle rolls at
 * 00:00 Asia/Jerusalem, including daylight saving.
 */
export const DAILY_TIME_ZONE = 'Asia/Jerusalem';

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

function wallClock(date: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DAILY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value == null) {
      throw new Error(`Missing ${type} for ${DAILY_TIME_ZONE}`);
    }
    return Number(value);
  };

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
  };
}

/** Israel calendar date of an instant. Rolls at midnight Asia/Jerusalem. */
export function jerusalemCalendarDate(date: Date): CalendarDate {
  const { year, month, day } = wallClock(date);
  return { year, month, day };
}

/**
 * Calendar date of the daily that is live at `date`.
 * This is the Israel calendar date, so it rolls at midnight Asia/Jerusalem.
 */
export function dailyGameDate(date: Date = new Date()): CalendarDate {
  return jerusalemCalendarDate(date);
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

/** Assignment key for whichever daily is live at `date` (rolls at midnight Israel). */
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
