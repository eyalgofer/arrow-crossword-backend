/** Bonus coins for the first user to complete a given day's daily puzzle. */
export const FIRST_DAILY_SOLVER_BONUS = 100;

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
