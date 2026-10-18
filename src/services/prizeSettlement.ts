import { MatchCompletionReason } from '../types';

export interface PrizePlayer {
  userId: string;
  rank: number;
  left?: boolean;
  /** Claimed pot boost for this player. Not taken from their wallet. */
  boost?: number;
}

export interface PrizeSettlementInput {
  kind: 'duel' | 'group';
  stake: number;
  opponentKind?: 'live' | 'replay' | 'solver' | null;
  reason: MatchCompletionReason | string;
  winnerId?: string | null;
  players: PrizePlayer[];
}

export interface PrizeSettlementLine {
  userId: string;
  coinsDelta: number;
}

export interface PrizeSettlement {
  stake: number;
  pot: number;
  settlement: PrizeSettlementLine[];
}

/** What first place is paid on a decisive result: 2× stake plus every claimed boost. */
export function headlinePot(stake: number, boostTotal: number): number {
  if (stake <= 0) {
    return 0;
  }
  return stake * 2 + boostTotal;
}

export function escrowPool(stake: number, playerCount: number, boostTotal: number): number {
  if (stake <= 0 || playerCount <= 0) {
    return 0;
  }
  return stake * playerCount + boostTotal;
}

/**
 * Coin credits applied at match end, after escrow has already lowered balances.
 * Calling this twice with the same input returns the same deltas.
 */
export function settlePrize(input: PrizeSettlementInput): PrizeSettlement {
  const players = input.players;
  if (
    input.stake <= 0
    || input.opponentKind === 'replay'
    || input.opponentKind === 'solver'
  ) {
    return {
      stake: 0,
      pot: 0,
      settlement: players.map(player => ({ userId: player.userId, coinsDelta: 0 }))
    };
  }

  const stake = input.stake;
  const boostTotal = players.reduce((sum, player) => sum + (player.boost ?? 0), 0);
  const pot = headlinePot(stake, boostTotal);
  const escrow = escrowPool(stake, players.length, boostTotal);
  const kind = input.kind === 'group' ? 'group' : 'duel';

  if (kind === 'duel') {
    return {
      stake,
      pot,
      settlement: settleDuel(input, stake, pot, escrow)
    };
  }

  return {
    stake,
    pot,
    settlement: settleGroup(input, stake, pot, escrow)
  };
}

function settleDuel(
  input: PrizeSettlementInput,
  stake: number,
  pot: number,
  escrow: number
): PrizeSettlementLine[] {
  if (input.reason === 'forfeit') {
    const stayer = input.winnerId
      ?? input.players.find(player => player.left !== true)?.userId
      ?? null;
    return input.players.map(player => ({
      userId: player.userId,
      coinsDelta: player.userId === stayer ? escrow : 0
    }));
  }

  if (!input.winnerId) {
    return input.players.map(player => ({
      userId: player.userId,
      coinsDelta: stake + (player.boost ?? 0)
    }));
  }

  const winnerId = input.winnerId;
  return input.players.map(player => ({
    userId: player.userId,
    coinsDelta: player.userId === winnerId ? pot : 0
  }));
}

function settleGroup(
  input: PrizeSettlementInput,
  stake: number,
  pot: number,
  escrow: number
): PrizeSettlementLine[] {
  const stillPlaying = input.players.filter(player => player.left !== true);
  if (input.reason === 'forfeit' && stillPlaying.length <= 1) {
    const winnerId = stillPlaying[0]?.userId ?? null;
    return input.players.map(player => ({
      userId: player.userId,
      coinsDelta: player.userId === winnerId ? escrow : 0
    }));
  }

  const leaders = input.players.filter(player => player.rank === 1);
  if (leaders.length >= 2) {
    const share = Math.floor(escrow / leaders.length);
    const short = share < stake;
    return input.players.map(player => {
      if (player.rank === 1) {
        return {
          userId: player.userId,
          coinsDelta: short ? stake + (player.boost ?? 0) : share
        };
      }
      return {
        userId: player.userId,
        coinsDelta: short ? stake : 0
      };
    });
  }

  return input.players.map(player => ({
    userId: player.userId,
    coinsDelta: player.rank === 1 ? pot : player.rank === 2 ? stake : 0
  }));
}
