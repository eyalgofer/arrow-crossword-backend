import mongoose from 'mongoose';
import { Server, Socket } from 'socket.io';
import { RANDOM_MATCH_SEARCH_MS } from '../constants/match';
import { RANDOM_QUEUE_STAKE } from '../constants/stakes';
import { User } from '../models/User';
import { Match } from '../models/Match';
import { activeGames } from './activeGames';
import { GameState, Language, DEFAULT_LANGUAGE, MatchMode, MatchStatus } from '../types';
import { pickMultiplayerPuzzle } from '../utils/multiplayerPuzzle';
import { createMatchTiming, serializeTimingFields } from '../utils/matchTiming';
import { startGhostMatch } from '../services/ghostMatch';
import { notifyRandomPlaySearch } from '../services/slack';
import { InsufficientCoinsError, insufficientCoinsBody } from '../services/prizeEscrow';
import { headlinePot } from '../services/prizeSettlement';
import {
  claimSearchHolds,
  claimedBoostsFromHolds,
  openSearchHold,
  refundSearchHold,
  refundSearchHoldByFirebase,
  releaseMatchedHolds
} from '../services/matchmakingHold';
import { parseRandomStake } from '../utils/stakes';

interface SearchSocket extends Socket {
  userId?: string;
  language?: Language;
}

interface WaitingPlayer {
  firebaseUid: string;
  userId: string;
  socketId: string;
  displayName: string;
  photoURL?: string;
  language: Language;
  coins: number;
}

const waitingPlayers = new Map<string, WaitingPlayer>();
const searchTimers = new Map<string, NodeJS.Timeout>();
const searchTokens = new Map<string, object>();

/**
 * Random search is one queue per language. Mode and skill are not split until
 * enough people are searching at once; a pair always starts a normal timed match.
 * If nobody else arrives, the search falls back to a replay or a paced solver.
 */
export async function handleFindMatch(
  io: Server,
  socket: SearchSocket,
  payload?: { stake?: unknown }
): Promise<void> {
  const firebaseUid = socket.userId;
  if (!firebaseUid) {
    socket.emit('error', { message: 'User not found' });
    return;
  }

  const stake = parseRandomStake(payload?.stake);
  if (!stake.ok) {
    socket.emit('error', { message: stake.error });
    return;
  }

  let queued = false;
  try {
    if (waitingPlayers.has(firebaseUid)) {
      socket.emit('error', { message: 'Already in matchmaking queue' });
      return;
    }

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      socket.emit('error', { message: 'User not found' });
      return;
    }
    if (user.isGuest) {
      socket.emit('error', { message: 'Sign in to play multiplayer' });
      return;
    }
    if (!user.displayName) {
      socket.emit('error', { message: 'Display name required' });
      return;
    }
    if (waitingPlayers.has(firebaseUid)) {
      socket.emit('error', { message: 'Already in matchmaking queue' });
      return;
    }

    const held = await openSearchHold({
      userId: user._id.toString(),
      firebaseUid,
      stake: stake.stake
    });
    queued = true;

    const entry: WaitingPlayer = {
      firebaseUid,
      userId: user._id.toString(),
      socketId: socket.id,
      displayName: user.displayName,
      photoURL: user.photoURL,
      language: socket.language ?? DEFAULT_LANGUAGE,
      coins: held.coins
    };
    waitingPlayers.set(firebaseUid, entry);
    void notifyRandomPlaySearch({
      displayName: user.displayName,
      language: entry.language,
      device: user.device,
    });

    const opponent = findOpponent(entry);
    if (opponent) {
      leaveQueue(firebaseUid);
      leaveQueue(opponent.firebaseUid);
      await startLiveMatch(io, entry, opponent);
      return;
    }

    armSearchTimer(io, entry);
    socket.emit('searching', {
      message: 'Searching for opponent...',
      searchMs: RANDOM_MATCH_SEARCH_MS,
      coins: held.coins
    });
  } catch (error) {
    console.error('Find match error:', error);
    if (firebaseUid && queued) {
      leaveQueue(firebaseUid);
      await refundSearchHoldByFirebase(firebaseUid);
    }
    if (error instanceof InsufficientCoinsError) {
      socket.emit('error', insufficientCoinsBody(error));
      return;
    }
    socket.emit('error', { message: 'Failed to find match' });
  }
}

export async function releaseRandomSearch(firebaseUid?: string): Promise<number | null> {
  if (!firebaseUid) {
    return null;
  }
  leaveQueue(firebaseUid);
  return refundSearchHoldByFirebase(firebaseUid);
}

/** @deprecated Use releaseRandomSearch so a queue escrow is refunded. */
export function cancelRandomSearch(firebaseUid?: string): void {
  void releaseRandomSearch(firebaseUid);
}

function findOpponent(entry: WaitingPlayer): WaitingPlayer | undefined {
  for (const [uid, waiting] of waitingPlayers) {
    if (uid !== entry.firebaseUid && waiting.language === entry.language) {
      return waiting;
    }
  }
  return undefined;
}

function leaveQueue(firebaseUid: string): void {
  const timer = searchTimers.get(firebaseUid);
  if (timer) {
    clearTimeout(timer);
    searchTimers.delete(firebaseUid);
  }
  searchTokens.delete(firebaseUid);
  waitingPlayers.delete(firebaseUid);
}

function armSearchTimer(io: Server, entry: WaitingPlayer): void {
  const existing = searchTimers.get(entry.firebaseUid);
  if (existing) {
    clearTimeout(existing);
  }

  const token = {};
  searchTokens.set(entry.firebaseUid, token);
  const timer = setTimeout(() => {
    void fallbackToGhost(io, entry, token);
  }, RANDOM_MATCH_SEARCH_MS);
  searchTimers.set(entry.firebaseUid, timer);
}

async function fallbackToGhost(io: Server, entry: WaitingPlayer, token: object): Promise<void> {
  if (searchTokens.get(entry.firebaseUid) !== token) {
    return;
  }
  const current = waitingPlayers.get(entry.firebaseUid);
  if (!current || current.socketId !== entry.socketId) {
    return;
  }

  waitingPlayers.delete(entry.firebaseUid);
  const timer = searchTimers.get(entry.firebaseUid);
  if (timer) {
    clearTimeout(timer);
    searchTimers.delete(entry.firebaseUid);
  }

  const stillSearching = () => searchTokens.get(entry.firebaseUid) === token;
  try {
    const refunded = await refundSearchHold(current.userId);
    if (!stillSearching()) {
      return;
    }
    await startGhostMatch(io, current.socketId, {
      _id: new mongoose.Types.ObjectId(current.userId),
      displayName: current.displayName,
      photoURL: current.photoURL
    }, current.language, stillSearching, refunded ?? undefined);
  } catch (error) {
    console.error('Ghost match error:', error);
    if (stillSearching()) {
      io.sockets.sockets.get(current.socketId)?.emit('error', { message: 'Failed to find match' });
    }
  } finally {
    if (searchTokens.get(entry.firebaseUid) === token) {
      searchTokens.delete(entry.firebaseUid);
    }
  }
}

async function startLiveMatch(io: Server, a: WaitingPlayer, b: WaitingPlayer): Promise<void> {
  const notify = (player: WaitingPlayer, message: string) => {
    io.sockets.sockets.get(player.socketId)?.emit('error', { message });
  };

  let holds;
  try {
    holds = await claimSearchHolds([a.userId, b.userId]);
  } catch (error) {
    console.error('Live match error:', error);
    notify(a, 'Failed to find match');
    notify(b, 'Failed to find match');
    return;
  }
  if (!holds) {
    notify(a, 'Failed to find match');
    notify(b, 'Failed to find match');
    return;
  }

  const coinsByUser = new Map(holds.map(hold => [hold.userId.toString(), hold.coins]));
  let matchId: string | null = null;
  try {
    const picked = await pickMultiplayerPuzzle(a.language);
    if (!picked) {
      await releaseMatchedHolds(holds);
      notify(a, 'No multiplayer puzzles configured');
      notify(b, 'No multiplayer puzzles configured');
      return;
    }

    const settings = { mode: MatchMode.NORMAL, timed: true as const };
    const timing = createMatchTiming(settings);
    const players = [a, b];
    const boosts = claimedBoostsFromHolds(holds);
    const boostTotal = boosts.reduce((sum, boost) => sum + boost.amount, 0);
    const match = new Match({
      players: players.map(player => ({
        userId: player.userId,
        displayName: player.displayName,
        photoURL: player.photoURL,
        progress: 0,
        claimedCount: 0
      })),
      puzzleId: picked.puzzle._id,
      claimedWords: [],
      mode: settings.mode,
      timed: timing.timed,
      startedAt: timing.startedAt,
      durationSeconds: timing.durationSeconds,
      endsAt: timing.endsAt,
      status: MatchStatus.IN_PROGRESS,
      opponentKind: 'live',
      stake: RANDOM_QUEUE_STAKE,
      pot: headlinePot(RANDOM_QUEUE_STAKE, boostTotal),
      boosts
    });
    await match.save();
    matchId = match._id.toString();

    const gameState: GameState = {
      matchId,
      players: players.map(player => ({
        userId: player.userId,
        displayName: player.displayName,
        photoURL: player.photoURL,
        progress: 0,
        claimedCount: 0
      })),
      puzzleId: picked.puzzle._id.toString(),
      moves: [],
      claimedWords: [],
      lockedCells: new Set<string>(),
      mode: settings.mode,
      ...timing
    };
    activeGames.set(matchId, gameState);

    for (const player of players) {
      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (!playerSocket) {
        continue;
      }
      const opponent = players.find(other => other.userId !== player.userId);
      playerSocket.join(matchId);
      playerSocket.emit('match_found', {
        matchId: match._id,
        puzzle: picked.puzzle,
        opponent: opponent ? {
          userId: opponent.userId,
          displayName: opponent.displayName,
          photoURL: opponent.photoURL
        } : null,
        opponentKind: 'live',
        mode: settings.mode,
        stake: RANDOM_QUEUE_STAKE,
        coins: coinsByUser.get(player.userId),
        ...serializeTimingFields(timing)
      });
    }
  } catch (error) {
    console.error('Live match error:', error);
    if (matchId) {
      await Match.deleteOne({ _id: matchId }).catch(() => undefined);
    }
    await releaseMatchedHolds(holds);
    notify(a, 'Failed to find match');
    notify(b, 'Failed to find match');
  }
}
