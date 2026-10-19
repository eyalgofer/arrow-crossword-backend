import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { Match, IMatch, IMatchSettlement } from '../models/Match';
import { User } from '../models/User';
import { MatchCompletionReason, MatchMode, MatchStatus } from '../types';
import { isMatchTimedOut } from '../utils/matchTiming';
import { removeActiveGame } from '../sockets/activeGames';
import { isBoardFullyClaimed, serializeClaimedWords, winnerIdFromClaimedCount } from './wordClaims';
import { isQuickMatch } from '../utils/matchSettings';
import { isGhostOpponentId } from '../utils/ghost';
import { buildPlacements, Placement, placementsForMatch, winnerIdFromPlacements } from './placements';
import { clientIdsForMatch, clientUserId } from './lobbyView';
import { settlePrize } from './prizeSettlement';
import { toIdString, toObjectId } from '../utils/objectId';

export interface MatchCompletedPlayer {
  userId: string;
  displayName: string;
  progress: number;
  claimedCount: number;
  left?: boolean;
}

export interface PublicSettlement {
  userId: string;
  coinsDelta: number;
  coins: number;
}

export interface MatchCompletedPayload {
  winnerId: string | null;
  reason: MatchCompletionReason;
  mode: MatchMode;
  stake: number;
  pot: number;
  settlement: PublicSettlement[];
  placements?: Placement[];
  match: {
    _id: string;
    winnerId: string | null;
    mode: MatchMode;
    stake: number;
    pot: number;
    settlement: PublicSettlement[];
    players: MatchCompletedPlayer[];
    claimedWords: ReturnType<typeof serializeClaimedWords>;
  };
}

export { winnerIdFromClaimedCount };

export function winnerIdFromProgress(
  players: IMatch['players']
): mongoose.Types.ObjectId | null {
  if (players.length === 0) {
    return null;
  }

  let best = players[0];
  let tied = false;

  for (let i = 1; i < players.length; i++) {
    const player = players[i];
    const playerProgress = player.progress ?? 0;
    const bestProgress = best.progress ?? 0;
    if (playerProgress > bestProgress) {
      best = player;
      tied = false;
    } else if (playerProgress === bestProgress) {
      tied = true;
    }
  }

  return tied ? null : toObjectId(best.userId);
}

export function winnerIdForMatch(match: IMatch): mongoose.Types.ObjectId | null {
  return isQuickMatch(match)
    ? winnerIdFromClaimedCount(match.players)
    : winnerIdFromProgress(match.players);
}

export function buildMatchCompletedPayload(
  match: IMatch,
  reason: MatchCompletionReason,
  clientIds?: ReadonlyMap<string, string> | null
): MatchCompletedPayload {
  const idOf = (id: unknown) => clientIds ? clientUserId(id, clientIds) : (toIdString(id) ?? '');
  const winnerId = clientIds ? (match.winnerId ? idOf(match.winnerId) : null) : toIdString(match.winnerId);
  const mode = isQuickMatch(match) ? MatchMode.QUICK : MatchMode.NORMAL;

  const players = match.players.map(player => {
    const row: MatchCompletedPlayer = {
      userId: idOf(player.userId),
      displayName: player.displayName,
      progress: player.progress ?? 0,
      claimedCount: player.claimedCount ?? 0
    };
    if (match.kind === 'group') {
      row.left = player.left === true;
    }
    return row;
  });

  const settlement = publicSettlement(match, idOf);
  const payload: MatchCompletedPayload = {
    winnerId,
    reason,
    mode,
    stake: match.stake ?? 0,
    pot: match.pot ?? 0,
    settlement,
    match: {
      _id: match._id.toString(),
      winnerId,
      mode,
      stake: match.stake ?? 0,
      pot: match.pot ?? 0,
      settlement,
      players,
      claimedWords: serializeClaimedWords(match.claimedWords).map(word => ({
        ...word,
        userId: idOf(word.userId)
      }))
    }
  };

  const placements = placementsForMatch(match.kind, match.players);
  if (placements) {
    payload.placements = placements.map(placement => ({
      ...placement,
      userId: idOf(placement.userId)
    }));
  }

  return payload;
}

export async function completeMatch(
  io: Server,
  matchId: string | mongoose.Types.ObjectId,
  options: {
    winnerId: mongoose.Types.ObjectId | string | null;
    reason: MatchCompletionReason;
  }
): Promise<IMatch | null> {
  const match = await Match.findOneAndUpdate(
    { _id: matchId, status: MatchStatus.IN_PROGRESS },
    {
      $set: {
        status: MatchStatus.COMPLETED,
        completedAt: new Date(),
        completionReason: options.reason
      }
    },
    { new: true }
  );

  if (!match) {
    return null;
  }

  const winnerId = match.kind === 'group'
    ? toObjectId(winnerIdFromPlacements(match.players))
    : toObjectId(options.winnerId);
  match.winnerId = winnerId;
  await match.save();

  await applyPrizeSettlement(match);

  const clientIds = await clientIdsForMatch(
    match._id.toString(),
    match.kind,
    match.players.map(player => player.userId)
  );
  const payload = buildMatchCompletedPayload(match, options.reason, clientIds);
  await emitMatchCompleted(io, match, payload);
  removeActiveGame(match._id.toString());

  return match;
}

export async function completeMatchByTimeout(
  io: Server,
  match: IMatch
): Promise<IMatch | null> {
  return completeMatch(io, match._id, {
    winnerId: winnerIdForMatch(match),
    reason: MatchCompletionReason.TIMEOUT
  });
}

export async function completeMatchIfBoardClaimed(
  io: Server,
  match: IMatch,
  totalClues: number
): Promise<IMatch | null> {
  if (!isQuickMatch(match) || !isBoardFullyClaimed(match, totalClues)) {
    return null;
  }

  return completeMatch(io, match._id, {
    winnerId: winnerIdFromClaimedCount(match.players),
    reason: MatchCompletionReason.BOARD_COMPLETED
  });
}

export async function ensureMatchNotExpired(
  io: Server,
  match: IMatch
): Promise<IMatch> {
  if (match.status !== MatchStatus.IN_PROGRESS || !isMatchTimedOut(match)) {
    return match;
  }

  const completed = await completeMatchByTimeout(io, match);
  if (completed) {
    return completed;
  }

  const latest = await Match.findById(match._id);
  return latest ?? match;
}

export async function getPlayableMatch(
  io: Server,
  matchId: string
): Promise<{ match?: IMatch; error?: string }> {
  const match = await Match.findById(matchId);
  if (!match) {
    return { error: 'Match not found' };
  }

  const current = await ensureMatchNotExpired(io, match);
  if (current.status !== MatchStatus.IN_PROGRESS) {
    return { error: 'Match is over' };
  }

  return { match: current };
}

export async function completeExpiredMatches(io: Server): Promise<string[]> {
  const inProgress = await Match.find({ status: MatchStatus.IN_PROGRESS });
  const completedIds: string[] = [];

  for (const match of inProgress) {
    if (!isMatchTimedOut(match)) {
      continue;
    }

    try {
      const completed = await completeMatchByTimeout(io, match);
      if (completed) {
        completedIds.push(completed._id.toString());
      }
    } catch (error) {
      console.error(`Failed to time out match ${match._id}:`, error);
    }
  }

  return completedIds;
}

async function applyPrizeSettlement(match: IMatch): Promise<void> {
  if (match.prizeSettled) {
    return;
  }

  const placements = buildPlacements(match.players);
  const players = match.players
    .filter(player => !isGhostOpponentId(player.userId))
    .map(player => {
      const userId = toIdString(player.userId) ?? '';
      const boost = (match.boosts ?? []).find(row => row.userId.toString() === userId);
      return {
        userId,
        rank: placements.find(placement => placement.userId === userId)?.rank ?? 0,
        left: player.left === true,
        boost: boost?.amount ?? 0
      };
    });

  const result = settlePrize({
    kind: match.kind === 'group' ? 'group' : 'duel',
    stake: match.stake ?? 0,
    opponentKind: match.opponentKind,
    reason: match.completionReason ?? MatchCompletionReason.COMPLETED,
    winnerId: toIdString(match.winnerId),
    players
  });

  const session = await mongoose.startSession();
  try {
    const credited = await session.withTransaction(async () => {
      const locked = await Match.findOneAndUpdate(
        { _id: match._id, prizeSettled: { $ne: true } },
        { $set: { prizeSettled: true, stake: result.stake, pot: result.pot } },
        { new: true, session }
      );
      if (!locked) {
        const existing = await Match.findById(match._id).session(session).select('settlement');
        return (existing?.settlement ?? []) as IMatchSettlement[];
      }

      const lines: IMatchSettlement[] = [];
      for (const line of result.settlement) {
        const playerId = toObjectId(line.userId);
        if (!playerId || isGhostOpponentId(playerId)) {
          continue;
        }

        const updated = await User.findByIdAndUpdate(
          playerId,
          { $inc: { coins: line.coinsDelta, ...statIncrements(match, playerId.toString()) } },
          { new: true, session }
        ).select('coins');

        lines.push({
          userId: playerId,
          coinsDelta: line.coinsDelta,
          coins: updated?.coins ?? 0
        });
      }

      await Match.updateOne(
        { _id: match._id },
        { $set: { settlement: lines } },
        { session }
      );
      return lines;
    });

    match.stake = result.stake;
    match.pot = result.pot;
    match.prizeSettled = true;
    match.settlement = credited;
  } finally {
    await session.endSession();
  }
}

function statIncrements(match: IMatch, playerId: string): Record<string, number> {
  const inc: Record<string, number> = { 'stats.totalGames': 1 };

  if (match.kind === 'group') {
    const placements = buildPlacements(match.players);
    const tied = placements.filter(placement => placement.rank === 1).length !== 1;
    const rank = placements.find(placement => placement.userId === playerId)?.rank;
    if (rank !== 1) {
      inc['stats.gamesLost'] = 1;
    } else if (!tied) {
      inc['stats.gamesWon'] = 1;
    }
    return inc;
  }

  const winnerId = toIdString(match.winnerId);
  if (winnerId) {
    inc[winnerId === playerId ? 'stats.gamesWon' : 'stats.gamesLost'] = 1;
  }
  return inc;
}

function publicSettlement(
  match: IMatch,
  idOf: (id: unknown) => string
): PublicSettlement[] {
  return (match.settlement ?? []).map(row => ({
    userId: idOf(row.userId),
    coinsDelta: row.coinsDelta,
    coins: row.coins
  }));
}

async function emitMatchCompleted(
  io: Server,
  match: IMatch,
  payload: MatchCompletedPayload
): Promise<void> {
  const matchId = match._id.toString();
  io.to(matchId).emit('match_completed', payload);

  const users = await User.find({
    _id: { $in: match.players.map(player => toObjectId(player.userId)).filter((id): id is mongoose.Types.ObjectId => id != null) }
  }).select('firebaseUid');

  for (const user of users) {
    io.to(`user:${user.firebaseUid}`).emit('match_completed', payload);
  }
}

export async function emitMatchPlayerLeft(io: Server, match: IMatch): Promise<void> {
  const matchId = match._id.toString();
  const clientIds = await clientIdsForMatch(
    match._id.toString(),
    match.kind,
    match.players.map(player => player.userId)
  );
  const payload = {
    matchId,
    players: match.players.map(player => ({
      userId: clientIds ? clientUserId(player.userId, clientIds) : (toIdString(player.userId) ?? ''),
      displayName: player.displayName,
      photoURL: player.photoURL ?? null,
      progress: player.progress ?? 0,
      claimedCount: player.claimedCount ?? 0,
      left: player.left === true
    }))
  };

  io.to(matchId).emit('player_left', payload);

  const users = await User.find({
    _id: { $in: match.players.map(player => toObjectId(player.userId)).filter((id): id is mongoose.Types.ObjectId => id != null) }
  }).select('firebaseUid');

  for (const user of users) {
    io.to(`user:${user.firebaseUid}`).emit('player_left', payload);
  }
}

