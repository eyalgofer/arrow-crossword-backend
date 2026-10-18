import { MATCH_STAKES, MatchStake, RANDOM_QUEUE_STAKE } from '../constants/stakes';

export type StakeParse =
  | { ok: true; stake: MatchStake }
  | { ok: false; error: string };

/**
 * Friend invites and group lobbies. A missing stake is friendly so older
 * clients are not charged.
 */
export function parseMatchStake(value: unknown): StakeParse {
  if (value == null || value === '') {
    return { ok: true, stake: 0 };
  }

  const stake = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN;

  if (!isMatchStake(stake)) {
    return { ok: false, error: 'stake must be 0, 100, or 250' };
  }

  return { ok: true, stake };
}

/** Random matchmaking has one queue and one stake. */
export function parseRandomStake(value: unknown): StakeParse {
  if (value !== RANDOM_QUEUE_STAKE) {
    return { ok: false, error: 'Random matchmaking stake must be 100' };
  }
  return { ok: true, stake: RANDOM_QUEUE_STAKE };
}

export function isMatchStake(value: number): value is MatchStake {
  return (MATCH_STAKES as readonly number[]).includes(value);
}
