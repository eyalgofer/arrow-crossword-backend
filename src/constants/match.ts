export const MATCH_QUICK_DURATION_SECONDS = Number.parseInt(
  process.env.MATCH_QUICK_DURATION_SECONDS || '300',
  10
) || 300;

export const MATCH_NORMAL_DURATION_SECONDS = Number.parseInt(
  process.env.MATCH_NORMAL_DURATION_SECONDS || process.env.MATCH_DURATION_SECONDS || '600',
  10
) || 600;

/** @deprecated Use MATCH_NORMAL_DURATION_SECONDS */
export const MATCH_DURATION_SECONDS = MATCH_NORMAL_DURATION_SECONDS;

export const MATCH_TIMEOUT_POLL_MS = Number.parseInt(
  process.env.MATCH_TIMEOUT_POLL_MS || '5000',
  10
) || 5000;

export const MATCH_REWARD_COINS = {
  WIN: 50,
  LOSS: 25,
  TIE: 25
} as const;
