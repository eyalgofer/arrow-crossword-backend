export interface DailyPuzzleStatsFields {
  solvedCount: number;
  fastestSeconds: number | null;
  currentStreak: number;
  lastSolvedDate: string | null;
}

/** YYYY-MM-DD in the server's local timezone (same convention as daily assignments). */
export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
