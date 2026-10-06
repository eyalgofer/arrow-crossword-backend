import { DAILY_HINT_LIMIT } from '../constants/daily';

export interface DailyHintLimitBody {
  code: 'daily_hint_limit';
  hintsUsed: number;
  hintLimit: number;
  coins: number;
}

export interface DailyHintSuccessBody {
  coins: number;
  hintsUsed: number;
  hintsRemaining: number;
  hintLimit: number;
}

export type HintPurchaseDecision =
  | { kind: 'limit'; body: DailyHintLimitBody }
  | { kind: 'insufficient' }
  | {
      kind: 'purchase';
      nextCoins: number;
      nextHintsUsed: number;
      /** Today's daily consumes one hint. Other puzzles only charge coins. */
      incrementHints: boolean;
      body: { coins: number } | DailyHintSuccessBody;
    };

/**
 * Decide a hint purchase from stored state.
 * The limit is checked before the balance so a capped daily is not charged.
 * A client-supplied hintsUsed value is never an input.
 */
export function decideHintPurchase(args: {
  isTodaysDaily: boolean;
  hintsUsed: number;
  coins: number;
  cost: number;
}): HintPurchaseDecision {
  const hintsUsed = Math.max(0, Math.floor(args.hintsUsed) || 0);

  if (args.isTodaysDaily && hintsUsed >= DAILY_HINT_LIMIT) {
    return {
      kind: 'limit',
      body: {
        code: 'daily_hint_limit',
        hintsUsed,
        hintLimit: DAILY_HINT_LIMIT,
        coins: args.coins,
      },
    };
  }

  if (args.coins < args.cost) {
    return { kind: 'insufficient' };
  }

  const nextCoins = args.coins - args.cost;
  if (!args.isTodaysDaily) {
    return {
      kind: 'purchase',
      nextCoins,
      nextHintsUsed: hintsUsed,
      incrementHints: false,
      body: { coins: nextCoins },
    };
  }

  const nextHintsUsed = hintsUsed + 1;
  return {
    kind: 'purchase',
    nextCoins,
    nextHintsUsed,
    incrementHints: true,
    body: {
      coins: nextCoins,
      hintsUsed: nextHintsUsed,
      hintsRemaining: DAILY_HINT_LIMIT - nextHintsUsed,
      hintLimit: DAILY_HINT_LIMIT,
    },
  };
}

/** Fastest-time records count only while the stored hint counter is still zero. */
export function countsTowardFastestTime(hintsUsed: number | null | undefined): boolean {
  return (hintsUsed ?? 0) <= 0;
}
