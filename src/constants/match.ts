export const MATCH_DURATION_SECONDS = Number.parseInt(
  process.env.MATCH_DURATION_SECONDS || '600',
  10
) || 600;

export const MATCH_TIMEOUT_POLL_MS = Number.parseInt(
  process.env.MATCH_TIMEOUT_POLL_MS || '5000',
  10
) || 5000;

export const MATCH_REWARD_COINS = {
  WIN: 50,
  LOSS: 25,
  TIE: 25
} as const;
