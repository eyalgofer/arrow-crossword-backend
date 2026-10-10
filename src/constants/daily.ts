/** Bonus coins for the first user to complete a given day's daily puzzle. */
export const FIRST_DAILY_SOLVER_BONUS = 100;

/** Overnight #1 prize for the fastest solver of yesterday's daily (credited at midnight). */
export const OVERNIGHT_DAILY_PRIZE_COINS = 500;

/** Israel local hour (0–23) when the overnight #1 winner push is sent. */
export const OVERNIGHT_PRIZE_PUSH_HOUR_ISRAEL = 9;

/** Successful hint purchases allowed on today's daily puzzle. */
export const DAILY_HINT_LIMIT = 3;

export const LETTER_HINT_COST = 5;
export const WORD_HINT_COST = 15;

export type DailyHintType = 'letter' | 'word';

export function dailyHintCost(type: unknown): number | null {
  if (type === 'letter') return LETTER_HINT_COST;
  if (type === 'word') return WORD_HINT_COST;
  return null;
}
