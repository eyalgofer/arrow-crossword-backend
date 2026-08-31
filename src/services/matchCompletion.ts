import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { Match, IMatch } from '../models/Match';
import { User } from '../models/User';
import { MatchCompletionReason, MatchMode, MatchStatus } from '../types';
import { MATCH_REWARD_COINS } from '../constants/match';
import { isMatchTimedOut } from '../utils/matchTiming';
import { removeActiveGame } from '../sockets/activeGames';
import { isBoardFullyClaimed, winnerIdFromClaimedCount } from './wordClaims';
import { isQuickMatch } from '../utils/matchSettings';

export interface MatchCompletedPlayer {
  userId: string;
  displayName: string;
  progress: number;
  claimedCount: number;
}

export interface MatchCompletedPayload {
  winnerId: string | null;
  reason: MatchCompletionReason;
  mode: MatchMode;
  match: {
    _id: string;
    winnerId: string | null;
    mode: MatchMode;
    players: MatchCompletedPlayer[];
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
  reason: MatchCompletionReason
): MatchCompletedPayload {
  const winnerId = toIdString(match.winnerId);
  const mode = isQuickMatch(match) ? MatchMode.QUICK : MatchMode.NORMAL;

  return {
    winnerId,
    reason,
    mode,
    match: {
      _id: match._id.toString(),
      winnerId,
      mode,
      players: match.players.map(player => ({
        userId: toIdString(player.userId) ?? '',
        displayName: player.displayName,
        progress: player.progress ?? 0,
        claimedCount: player.claimedCount ?? 0
      }))
    }
  };
}

export async function completeMatch(
  io: Server,
  matchId: string | mongoose.Types.ObjectId,
  options: {
    winnerId: mongoose.Types.ObjectId | string | null;
    reason: MatchCompletionReason;
  }
): Promise<IMatch | null> {
  const winnerId = toObjectId(options.winnerId);

  const match = await Match.findOneAndUpdate(
    { _id: matchId, status: MatchStatus.IN_PROGRESS },
    {
      $set: {
        status: MatchStatus.COMPLETED,
        winnerId,
        completedAt: new Date(),
        completionReason: options.reason
      }
    },
    { new: true }
  );

  if (!match) {
    return null;
  }

  await awardMatchRewards(match, winnerId);

  const payload = buildMatchCompletedPayload(match, options.reason);
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
  const isTie = winnerId == null;

  await Promise.all(match.players.map(async (player) => {
    const playerId = toObjectId(player.userId);
    if (!playerId) {
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
