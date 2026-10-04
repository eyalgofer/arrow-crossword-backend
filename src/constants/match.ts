export const MATCH_QUICK_DURATION_SECONDS = Number.parseInt(
  process.env.MATCH_QUICK_DURATION_SECONDS || '300',
  10
) || 300;

export const MATCH_NORMAL_DURATION_SECONDS = Number.parseInt(
  process.env.MATCH_NORMAL_DURATION_SECONDS || '600',
  10
) || 600;

/** @deprecated Use MATCH_NORMAL_DURATION_SECONDS */
export const MATCH_DURATION_SECONDS = MATCH_NORMAL_DURATION_SECONDS;

export const MATCH_TIMEOUT_POLL_MS = Number.parseInt(
  process.env.MATCH_TIMEOUT_POLL_MS || '5000',
  10
) || 5000;

/** How long a random search waits for another person in the same language. */
export const RANDOM_MATCH_SEARCH_MS = 20_000;

/** How often replay and solver opponents apply their next action. */
export const GHOST_TICK_MS = 1_000;

/**
 * Player id used for replay and solver opponents.
 * Not a user account, so match rewards never land on a real person.
 */
export const GHOST_OPPONENT_ID = '0000000000000000000000aa';

export const MATCH_REWARD_COINS = {
  WIN: 50,
  LOSS: 25,
  TIE: 25
} as const;
