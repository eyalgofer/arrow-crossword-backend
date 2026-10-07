import { dailyGameDateString } from './dailyClock';
import { countsTowardFastestTime } from './dailyHints';

export interface DailyPuzzleStatsFields {
  solvedCount: number;
  fastestSeconds: number | null;
  currentStreak: number;
  lastSolvedDate: string | null;
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
