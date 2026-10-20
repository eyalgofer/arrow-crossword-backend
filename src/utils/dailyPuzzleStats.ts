import { calendarDayOfYear, dailyGameDateString } from './dailyClock';
import { countsTowardFastestTime } from './dailyHints';

export interface DailyPuzzleStatsFields {
  solvedCount: number;
  fastestSeconds: number | null;
  currentStreak: number;
  lastSolvedDate: string | null;
}

/** One cell of the profile week strip. `placement` is null when that day was not solved. */
export interface DayPlacement {
  date: string;
  placement: number | null;
}

export interface DailyProfilePlacements {
  /** Distinct daily puzzles this user has completed. */
  solvedCount: number;
  wins: number;
  coinsWon: number;
  bestPlacement: number | null;
  last7: DayPlacement[];
}

/** A daily this user finished, with the calendar dates that puzzle was assigned. */
export interface SolvedDaily {
  puzzleId: string;
  bestTime: number | null;
  dates: string[];
}

/** Another player's timed finish on a daily puzzle. */
export interface OtherSolveTime {
  puzzleId: string;
  bestTime: number;
}

/** YYYY-MM-DD of the daily that is live at `date` (midnight Asia/Jerusalem). */
export function toLocalDateString(date: Date = new Date()): string {
  return dailyGameDateString(date);
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole calendar days from `from` to `to` (local YYYY-MM-DD strings). */
export function localDateDiffDays(from: string, to: string): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function emptyDailyPuzzleStats(): DailyPuzzleStatsFields {
  return {
    solvedCount: 0,
    fastestSeconds: null,
    currentStreak: 0,
    lastSolvedDate: null,
  };
}

/** YYYY-MM-DD shifted by whole calendar days. Uses UTC so DST cannot skip a date. */
export function shiftDateString(dateStr: string, deltaDays: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Seven calendar days, oldest through `today`. */
export function last7DateStrings(today: string): string[] {
  const dates: string[] = [];
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    dates.push(shiftDateString(today, -daysAgo));
  }
  return dates;
}

/** Israel assignment key for a YYYY-MM-DD daily date. */
export function dailyKeyFromDateString(dateStr: string): { year: number; dayOfYear: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, dayOfYear: calendarDayOfYear({ year, month, day }) };
}

/** YYYY-MM-DD for a daily assignment key. */
export function dateStringFromDailyKey(year: number, dayOfYear: number): string {
  const date = new Date(Date.UTC(year, 0, dayOfYear));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Finish ranks for the profile card.
 * Rank is 1 + the number of strictly faster timed solves (ties share a place).
 * A day outside the last 7 still counts toward `bestPlacement`.
 * The best rank is the current place, so a solver who is passed before midnight
 * loses a provisional 1st.
 */
export function placementsForSolves(
  today: string,
  mine: SolvedDaily[],
  others: OtherSolveTime[]
): { bestPlacement: number | null; last7: DayPlacement[] } {
  const othersByPuzzle = new Map<string, number[]>();
  for (const row of others) {
    if (!(row.bestTime > 0)) continue;
    const times = othersByPuzzle.get(row.puzzleId) ?? [];
    times.push(row.bestTime);
    othersByPuzzle.set(row.puzzleId, times);
  }

  const placementByDate = new Map<string, number>();
  let bestPlacement: number | null = null;

  for (const solve of mine) {
    const myTime = solve.bestTime;
    if (typeof myTime !== 'number' || !(myTime > 0)) continue;
    const faster = (othersByPuzzle.get(solve.puzzleId) ?? []).filter(
      (time) => time < myTime
    ).length;
    const rank = faster + 1;
    if (bestPlacement == null || rank < bestPlacement) {
      bestPlacement = rank;
    }
    for (const date of solve.dates) {
      const previous = placementByDate.get(date);
      if (previous == null || rank < previous) {
        placementByDate.set(date, rank);
      }
    }
  }

  return {
    bestPlacement,
    last7: last7DateStrings(today).map((date) => ({
      date,
      placement: placementByDate.get(date) ?? null,
    })),
  };
}

/**
 * Streak as of today: active if last solve was today or yesterday, else 0.
 */
export function effectiveCurrentStreak(stats: DailyPuzzleStatsFields | null | undefined): number {
  if (!stats?.lastSolvedDate || !stats.currentStreak) {
    return 0;
  }
  const diff = localDateDiffDays(stats.lastSolvedDate, toLocalDateString());
  if (diff <= 1) {
    return stats.currentStreak;
  }
  return 0;
}

/**
 * Update streak + lastSolvedDate for a first-time unique daily solve on `today`.
 */
export function applyDailyStreak(stats: DailyPuzzleStatsFields, today: string = toLocalDateString()): void {
  const last = stats.lastSolvedDate;

  if (!last) {
    stats.currentStreak = 1;
  } else if (last === today) {
    // Same calendar day — leave streak unchanged
  } else if (localDateDiffDays(last, today) === 1) {
    stats.currentStreak += 1;
  } else {
    stats.currentStreak = 1;
  }

  stats.lastSolvedDate = today;
}

/** Consecutive days ending today/yesterday from a sorted unique list of YYYY-MM-DD. */
export function streakFromSolveDates(
  dateKeys: string[],
  today: string = toLocalDateString()
): { currentStreak: number; lastSolvedDate: string | null } {
  const unique = [...new Set(dateKeys.filter(Boolean))].sort();
  if (unique.length === 0) {
    return { currentStreak: 0, lastSolvedDate: null };
  }

  const lastSolvedDate = unique[unique.length - 1];
  const gap = localDateDiffDays(lastSolvedDate, today);
  if (gap > 1) {
    return { currentStreak: 0, lastSolvedDate };
  }

  let currentStreak = 1;
  for (let i = unique.length - 1; i > 0; i--) {
    if (localDateDiffDays(unique[i - 1], unique[i]) === 1) {
      currentStreak += 1;
    } else {
      break;
    }
  }
  return { currentStreak, lastSolvedDate };
}

export type DailySolveRecord = {
  bestTime: number | null;
  lastPlayedAt: Date | null;
  hintsUsed?: number | null;
};

/** Build lifetime stats from completed daily-puzzle progress rows. */
export function deriveDailyPuzzleStatsFromProgress(
  completes: DailySolveRecord[],
  today: string = toLocalDateString()
): DailyPuzzleStatsFields {
  const solvedCount = completes.length;
  let fastestSeconds: number | null = null;
  for (const row of completes) {
    if (
      countsTowardFastestTime(row.hintsUsed) &&
      typeof row.bestTime === 'number' &&
      row.bestTime >= 0
    ) {
      fastestSeconds =
        fastestSeconds == null ? row.bestTime : Math.min(fastestSeconds, row.bestTime);
    }
  }

  const dateKeys = completes
    .map((row) => (row.lastPlayedAt ? toLocalDateString(new Date(row.lastPlayedAt)) : null))
    .filter((d): d is string => !!d);

  const { currentStreak, lastSolvedDate } = streakFromSolveDates(dateKeys, today);

  return {
    solvedCount,
    fastestSeconds,
    currentStreak,
    lastSolvedDate,
  };
}
