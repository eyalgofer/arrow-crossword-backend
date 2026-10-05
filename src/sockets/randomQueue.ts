import mongoose from 'mongoose';
import { Server, Socket } from 'socket.io';
import { RANDOM_MATCH_SEARCH_MS } from '../constants/match';
import { User } from '../models/User';
import { Match } from '../models/Match';
import { activeGames } from './activeGames';
import { GameState, Language, DEFAULT_LANGUAGE, MatchMode, MatchStatus } from '../types';
import { pickMultiplayerPuzzle } from '../utils/multiplayerPuzzle';
import { createMatchTiming, serializeTimingFields } from '../utils/matchTiming';
import { startGhostMatch } from '../services/ghostMatch';

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
}

const waitingPlayers = new Map<string, WaitingPlayer>();
const searchTimers = new Map<string, NodeJS.Timeout>();
const searchTokens = new Map<string, object>();

/**
 * Random search is one queue per language. Mode and skill are not split until
 * enough people are searching at once; a pair always starts a normal timed match.
 * If nobody else arrives, the search falls back to a replay or a paced solver.
 */
export async function handleFindMatch(io: Server, socket: SearchSocket): Promise<void> {
  const firebaseUid = socket.userId;
  if (!firebaseUid) {
    socket.emit('error', { message: 'User not found' });
    return;
  }

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

    const entry: WaitingPlayer = {
      firebaseUid,
      userId: user._id.toString(),
      socketId: socket.id,
      displayName: user.displayName,
      photoURL: user.photoURL,
      language: socket.language ?? DEFAULT_LANGUAGE
    };
    waitingPlayers.set(firebaseUid, entry);

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
      searchMs: RANDOM_MATCH_SEARCH_MS
    });
  } catch (error) {
    console.error('Find match error:', error);
    if (firebaseUid) {
      leaveQueue(firebaseUid);
    }
    socket.emit('error', { message: 'Failed to find match' });
  }
}

export function cancelRandomSearch(firebaseUid?: string): void {
  if (!firebaseUid) {
    return;
  }
  leaveQueue(firebaseUid);
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
    await startGhostMatch(io, current.socketId, {
      _id: new mongoose.Types.ObjectId(current.userId),
      displayName: current.displayName,
      photoURL: current.photoURL
    }, current.language, stillSearching);
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

  try {
    const picked = await pickMultiplayerPuzzle(a.language);
    if (!picked) {
      notify(a, 'No multiplayer puzzles configured');
      notify(b, 'No multiplayer puzzles configured');
      return;
    }

    const settings = { mode: MatchMode.NORMAL, timed: true as const };
    const timing = createMatchTiming(settings);
    const players = [a, b];
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
      opponentKind: 'live'
    });
    await match.save();

    const gameState: GameState = {
      matchId: match._id.toString(),
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
    activeGames.set(match._id.toString(), gameState);

    for (const player of players) {
      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (!playerSocket) {
        continue;
      }
      const opponent = players.find(other => other.userId !== player.userId);
      playerSocket.join(match._id.toString());
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
        ...serializeTimingFields(timing)
      });
    }
  } catch (error) {
    console.error('Live match error:', error);
    notify(a, 'Failed to find match');
    notify(b, 'Failed to find match');
  }
}
