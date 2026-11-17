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

/** Hour (0–23) and minute on the Israel wall clock for an instant. */
export function jerusalemWallTime(date: Date = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DAILY_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value == null) {
      throw new Error(`Missing ${type} for ${DAILY_TIME_ZONE}`);
    }
    return Number(value);
  };

  return { hour: read('hour'), minute: read('minute') };
}

/** True when Israel local time is at or after `hour` (0–23) on the same calendar day. */
export function isAtOrAfterJerusalemHour(hour: number, date: Date = new Date()): boolean {
  const { hour: localHour } = jerusalemWallTime(date);
  return localHour >= hour;
}

/**
 * True when `(year, dayOfYear)` is strictly before the live daily key at `date`.
 * Used to find dailies whose overnight prize claim has frozen.
 */
export function isBeforeLiveDailyKey(
  year: number,
  dayOfYear: number,
  date: Date = new Date()
): boolean {
  const live = liveDailyKey(date);
  if (year < live.year) return true;
  if (year > live.year) return false;
  return dayOfYear < live.dayOfYear;
}

function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Israel wall-clock fields of an instant, as if those fields were UTC. */
function jerusalemWallAsUtc(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DAILY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value == null) {
      throw new Error(`Missing ${type} for ${DAILY_TIME_ZONE}`);
    }
    return Number(value);
  };

  let hour = read('hour');
  let day = read('day');
  let month = read('month');
  let year = read('year');
  if (hour === 24) {
    hour = 0;
    const next = addCalendarDays({ year, month, day }, 1);
    year = next.year;
    month = next.month;
    day = next.day;
  }

  return Date.UTC(year, month - 1, day, hour, read('minute'), read('second'));
}

/** UTC instant of a civil time in Asia/Jerusalem. Midnight is never inside the DST gap. */
export function jerusalemLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = jerusalemWallAsUtc(new Date(localAsUtc)) - localAsUtc;
  const utc = localAsUtc - offset;
  const offsetAtUtc = jerusalemWallAsUtc(new Date(utc)) - utc;
  if (offsetAtUtc !== offset) {
    return new Date(localAsUtc - offsetAtUtc);
  }
  return new Date(utc);
}

/** The next midnight in Asia/Jerusalem after `date`. That instant ends today's daily. */
export function nextJerusalemMidnight(date: Date = new Date()): Date {
  const next = addCalendarDays(jerusalemCalendarDate(date), 1);
  return jerusalemLocalToUtc(next.year, next.month, next.day);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Israel wall-clock hour the instant falls in, as `YYYY-MM-DDTHH`.
 * Hour 24 from Intl is the next midnight.
 */
export function jerusalemHourKey(date: Date = new Date()): string {
  const calendar = jerusalemCalendarDate(date);
  let { hour } = jerusalemWallTime(date);
  let { year, month, day } = calendar;
  if (hour === 24) {
    hour = 0;
    const next = addCalendarDays(calendar, 1);
    year = next.year;
    month = next.month;
    day = next.day;
  }
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}`;
}

const HOUR_KEY = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/;

function hourKeyParts(key: string): { year: number; month: number; day: number; hour: number } | null {
  const match = HOUR_KEY.exec(key);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
  };
}

/** Start of the next Israel hour. That instant ends the current five-letter word. */
export function nextJerusalemHour(date: Date = new Date()): Date {
  const current = jerusalemHourKey(date);
  const parts = hourKeyParts(current);
  if (!parts) {
    throw new Error(`Bad Israel hour key ${current}`);
  }
  let { year, month, day, hour } = parts;
  hour += 1;
  if (hour >= 24) {
    const next = addCalendarDays({ year, month, day }, 1);
    year = next.year;
    month = next.month;
    day = next.day;
    hour = 0;
  }
  let instant = jerusalemLocalToUtc(year, month, day, hour);
  // A spring-forward gap has no civil time for the skipped hour.
  if (jerusalemHourKey(instant) <= current) {
    hour += 1;
    if (hour >= 24) {
      const next = addCalendarDays({ year, month, day }, 1);
      year = next.year;
      month = next.month;
      day = next.day;
      hour = 0;
    }
    instant = jerusalemLocalToUtc(year, month, day, hour);
  }
  return instant;
}

/** True when `key` is a five-letter hour that has already ended at `date`. */
export function isBeforeLiveJerusalemHour(key: string, date: Date = new Date()): boolean {
  if (!HOUR_KEY.test(key)) return false;
  return key < jerusalemHourKey(date);
}
