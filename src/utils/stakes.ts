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

/**
 * Random matchmaking has one queue. A missing stake is an older client and
 * joins for free. A stake that is present must be 100.
 */
export function parseRandomStake(value: unknown): StakeParse {
  if (value == null || value === '') {
    return { ok: true, stake: 0 };
  }
  if (value !== RANDOM_QUEUE_STAKE) {
    return { ok: false, error: 'Random matchmaking stake must be 100' };
  }
  return { ok: true, stake: RANDOM_QUEUE_STAKE };
}

/** Only an explicit true opts this request into escrow. */
export function optedIntoStakes(value: unknown): boolean {
  return value === true;
}

export interface PrizePlayDecision {
  stake: number;
  escrow: boolean;
  stakeDowngraded?: true;
}

/**
 * Escrow only when the stake is positive and every player who would pay opted in.
 * A positive stake with anyone opted out becomes a free match. Stake 0 never
 * sets stakeDowngraded, whether or not the players opted in.
 */
export function decidePrizePlay(input: {
  stake: number;
  optedIn: boolean[];
}): PrizePlayDecision {
  if (input.stake > 0 && input.optedIn.length > 0 && input.optedIn.every(Boolean)) {
    return { stake: input.stake, escrow: true };
  }
  if (input.stake > 0) {
    return { stake: 0, escrow: false, stakeDowngraded: true };
  }
  return { stake: 0, escrow: false };
}

export function isMatchStake(value: number): value is MatchStake {
  return (MATCH_STAKES as readonly number[]).includes(value);
}
