import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { Match, IMatch } from '../models/Match';
import { User } from '../models/User';
import { MatchCompletionReason, MatchMode, MatchStatus } from '../types';
import { MATCH_REWARD_COINS } from '../constants/match';
import { isMatchTimedOut } from '../utils/matchTiming';
import { removeActiveGame } from '../sockets/activeGames';
import { isBoardFullyClaimed, serializeClaimedWords, winnerIdFromClaimedCount } from './wordClaims';
import { isQuickMatch } from '../utils/matchSettings';
import { isGhostOpponentId } from '../utils/ghost';
import { buildPlacements, Placement, placementsForMatch, winnerIdFromPlacements } from './placements';
import { clientIdsForMatch, clientUserId } from './lobbyView';

export interface MatchCompletedPlayer {
  userId: string;
  displayName: string;
  progress: number;
  claimedCount: number;
  left?: boolean;
}

export interface MatchCompletedPayload {
  winnerId: string | null;
  reason: MatchCompletionReason;
  mode: MatchMode;
  placements?: Placement[];
  match: {
    _id: string;
    winnerId: string | null;
    mode: MatchMode;
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

  const payload: MatchCompletedPayload = {
    winnerId,
    reason,
    mode,
    match: {
      _id: match._id.toString(),
      winnerId,
      mode,
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

  await awardMatchRewards(match, winnerId);

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

async function awardMatchRewards(
  match: IMatch,
  winnerId: mongoose.Types.ObjectId | null
): Promise<void> {
  if (match.kind === 'group') {
    await awardGroupRewards(match);
    return;
  }

  const isTie = winnerId == null;

  await Promise.all(match.players.map(async (player) => {
    const playerId = toObjectId(player.userId);
    if (!playerId || isGhostOpponentId(playerId)) {
      return;
    }

    const isWinner = !isTie && playerId.toString() === winnerId.toString();
    const coins = isTie
      ? MATCH_REWARD_COINS.TIE
      : isWinner
        ? MATCH_REWARD_COINS.WIN
        : MATCH_REWARD_COINS.LOSS;

    const inc: Record<string, number> = {
      coins,
      'stats.totalGames': 1
    };

    if (!isTie) {
      if (isWinner) {
        inc['stats.gamesWon'] = 1;
      } else {
        inc['stats.gamesLost'] = 1;
      }
    }

    await User.updateOne({ _id: playerId }, { $inc: inc });
  }));
}

async function awardGroupRewards(match: IMatch): Promise<void> {
  const placements = buildPlacements(match.players);
  const leaders = placements.filter(placement => placement.rank === 1);
  const tied = leaders.length !== 1;

  await Promise.all(match.players.map(async (player) => {
    const playerId = toObjectId(player.userId);
    if (!playerId || isGhostOpponentId(playerId)) {
      return;
    }

    const rank = placements.find(placement => placement.userId === playerId.toString())?.rank;
    const isLeader = rank === 1;
    const coins = isLeader
      ? (tied ? MATCH_REWARD_COINS.TIE : MATCH_REWARD_COINS.WIN)
      : MATCH_REWARD_COINS.LOSS;

    const inc: Record<string, number> = {
      coins,
      'stats.totalGames': 1
    };

    if (!isLeader) {
      inc['stats.gamesLost'] = 1;
    } else if (!tied) {
      inc['stats.gamesWon'] = 1;
    }

    await User.updateOne({ _id: playerId }, { $inc: inc });
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

function toObjectId(id: unknown): mongoose.Types.ObjectId | null {
  if (id == null) {
    return null;
  }
  if (id instanceof mongoose.Types.ObjectId) {
    return id;
  }
  if (typeof id === 'object' && id !== null && '_id' in id) {
    return toObjectId((id as { _id: unknown })._id);
  }
  if (mongoose.Types.ObjectId.isValid(String(id))) {
    return new mongoose.Types.ObjectId(String(id));
  }
  return null;
}

function toIdString(id: unknown): string | null {
  const objectId = toObjectId(id);
  return objectId ? objectId.toString() : null;
}
