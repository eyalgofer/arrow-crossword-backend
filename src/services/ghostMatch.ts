import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { GHOST_TICK_MS, MATCH_NORMAL_DURATION_SECONDS } from '../constants/match';
import { Match, IMatch } from '../models/Match';
import { Puzzle, IPuzzle } from '../models/Puzzle';
import { activeGames } from '../sockets/activeGames';
import { GameState, Language, MatchCompletionReason, MatchMode, MatchStatus, OpponentKind } from '../types';
import { pickMultiplayerPuzzle } from '../utils/multiplayerPuzzle';
import { createMatchTiming, serializeTimingFields } from '../utils/matchTiming';
import { generateThemedNickname, ghostOpponentObjectId, isGhostOpponentId } from '../utils/ghost';
import { isDisplayNameTaken } from '../utils/displayName';
import { buildReplaySchedule, buildSolverSchedule, ReplaySource } from './ghostSchedule';
import { completeMatch } from './matchCompletion';

interface ReplayCandidate {
  displayName: string;
  photoURL?: string;
  source: ReplaySource;
}

export async function startGhostMatch(
  io: Server,
  socketId: string,
  user: {
    _id: mongoose.Types.ObjectId;
    displayName: string;
    photoURL?: string;
  },
  language: Language,
  stillSearching: () => boolean = () => true
): Promise<void> {
  const socket = io.sockets.sockets.get(socketId);
  const fail = (message: string) => {
    socket?.emit('error', { message });
  };

  const picked = await pickMultiplayerPuzzle(language);
  if (!stillSearching()) {
    return;
  }
  if (!picked) {
    fail('No multiplayer puzzles configured');
    return;
  }

  const replay = await findReplay(picked.puzzleId, user._id);
  const durationMs = MATCH_NORMAL_DURATION_SECONDS * 1000;
  const opponentKind: OpponentKind = replay ? 'replay' : 'solver';
  const events = replay
    ? buildReplaySchedule(replay.source, durationMs)
    : buildSolverSchedule(durationMs, Date.now() ^ user._id.getTimestamp().getTime());
  const schedule = events.length > 0 ? events : buildSolverSchedule(durationMs, Date.now());
  const kind: OpponentKind = replay && events.length > 0 ? opponentKind : 'solver';
  if (!stillSearching()) {
    return;
  }

  const settings = { mode: MatchMode.NORMAL, timed: true as const };
  const timing = createMatchTiming(settings);
  const ghostId = ghostOpponentObjectId();
  const displayName = kind === 'replay' && replay?.displayName
    ? replay.displayName
    : await pickSolverNickname(language, user.displayName);
  const opponent = {
    userId: ghostId.toString(),
    displayName,
    photoURL: kind === 'replay' ? replay?.photoURL : undefined
  };

  const match = new Match({
    players: [
      {
        userId: user._id,
        displayName: user.displayName,
        photoURL: user.photoURL,
        progress: 0,
        claimedCount: 0
      },
      {
        userId: ghostId,
        displayName: opponent.displayName,
        photoURL: opponent.photoURL,
        progress: 0,
        claimedCount: 0
      }
    ],
    puzzleId: picked.puzzleId,
    claimedWords: [],
    mode: settings.mode,
    timed: timing.timed,
    startedAt: timing.startedAt,
    durationSeconds: timing.durationSeconds,
    endsAt: timing.endsAt,
    status: MatchStatus.IN_PROGRESS,
    opponentKind: kind,
    ghostEvents: schedule,
    ghostApplied: 0
  });
  await match.save();
  if (!stillSearching()) {
    await Match.updateOne(
      { _id: match._id, status: MatchStatus.IN_PROGRESS },
      { $set: { status: MatchStatus.CANCELLED } }
    );
    return;
  }

  rememberGame(match, picked.puzzle, timing);
  socket?.join(match._id.toString());
  socket?.emit('match_found', {
    matchId: match._id,
    puzzle: picked.puzzle,
    opponent,
    opponentKind: kind,
    mode: settings.mode,
    ...serializeTimingFields(timing)
  });

  console.log(`[MATCH] ${kind} opponent for ${user._id} on puzzle ${picked.puzzleId} (${schedule.length} events)`);
}

export async function advanceGhostMatch(
  io: Server,
  matchId: string,
  options?: { emit?: boolean }
): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(matchId)) {
    return;
  }

  const match = await Match.findOne({
    _id: matchId,
    status: MatchStatus.IN_PROGRESS,
    opponentKind: { $in: ['replay', 'solver'] }
  }).select('+ghostEvents +ghostApplied');

  if (!match) {
    return;
  }

  const events = match.ghostEvents ?? [];
  const cursor = match.ghostApplied ?? 0;
  if (cursor >= events.length) {
    return;
  }

  const startedAt = match.startedAt?.getTime() ?? Date.now();
  const elapsed = Date.now() - startedAt;
  let next = cursor;
  while (next < events.length && events[next].atMs <= elapsed) {
    next += 1;
  }
  if (next === cursor) {
    return;
  }

  const due = events.slice(cursor, next);
  const ghostId = ghostOpponentObjectId();
  const latestProgress = [...due].reverse().find(event => event.type === 'progress')?.progress;
  const finish = due.some(event => event.type === 'finish');
  const moves = due
    .filter(event => event.type === 'move' && event.row != null && event.col != null && event.letter)
    .map(event => ({
      userId: ghostId,
      row: event.row as number,
      col: event.col as number,
      letter: event.letter as string,
      timestamp: new Date(startedAt + event.atMs)
    }));

  const $set: Record<string, unknown> = { ghostApplied: next };
  const touchesGhost = latestProgress != null || finish;
  if (latestProgress != null) {
    $set['players.$[ghost].progress'] = latestProgress;
  }
  if (finish) {
    $set['players.$[ghost].progress'] = 100;
    $set['players.$[ghost].completedAt'] = new Date(startedAt + (due.find(event => event.type === 'finish')?.atMs ?? elapsed));
  }

  const updated = await Match.findOneAndUpdate(
    { _id: match._id, status: MatchStatus.IN_PROGRESS, ghostApplied: cursor },
    {
      $set,
      ...(moves.length > 0 ? { $push: { moves: { $each: moves } } } : {})
    },
    touchesGhost
      ? { arrayFilters: [{ 'ghost.userId': ghostId }], new: true }
      : { new: true }
  );

  if (!updated) {
    return;
  }

  syncActiveGame(matchId, ghostId.toString(), latestProgress, finish, moves);

  const emit = options?.emit !== false;
  if (emit) {
    if (latestProgress != null || finish) {
      io.to(matchId).emit('opponent_progress', {
        userId: ghostId.toString(),
        progress: finish ? 100 : latestProgress
      });
    }
    for (const move of moves) {
      io.to(matchId).emit('opponent_move', {
        userId: ghostId.toString(),
        row: move.row,
        col: move.col,
        letter: move.letter
      });
    }
  }

  if (finish) {
    await completeMatch(io, matchId, {
      winnerId: ghostId,
      reason: MatchCompletionReason.COMPLETED
    });
  }
}

export async function advanceDueGhostMatches(io: Server): Promise<void> {
  const matches = await Match.find({
    status: MatchStatus.IN_PROGRESS,
    opponentKind: { $in: ['replay', 'solver'] }
  }).select('_id');

  for (const match of matches) {
    try {
      await advanceGhostMatch(io, match._id.toString(), { emit: true });
    } catch (error) {
      console.error(`Ghost match ${match._id} failed to advance:`, error);
    }
  }
}

export function startGhostTicker(io: Server): NodeJS.Timeout {
  let running = false;
  const tick = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      await advanceDueGhostMatches(io);
    } catch (error) {
      console.error('Ghost ticker error:', error);
    } finally {
      running = false;
    }
  };

  return setInterval(() => {
    void tick();
  }, GHOST_TICK_MS);
}

const GENERIC_OPPONENT_NAMES = new Set([
  '',
  'יריב',
  'יריב לתרגול',
  'opponent',
  'practice opponent',
]);

function isGenericOpponentName(name: string | null | undefined): boolean {
  return GENERIC_OPPONENT_NAMES.has((name ?? '').trim().toLocaleLowerCase());
}

/** Older fallback matches stored the label "יריב". Give them a signup-style name. */
export async function ensureSolverNickname(match: IMatch): Promise<void> {
  if (match.opponentKind !== 'solver') {
    return;
  }

  const index = match.players.findIndex((player) => {
    if (isGhostOpponentId(player.userId)) {
      return true;
    }
    return player.userId == null;
  });
  if (index < 0 || !isGenericOpponentName(match.players[index].displayName)) {
    return;
  }

  const puzzle = await Puzzle.findById(match.puzzleId).select('language').lean();
  const language: Language = puzzle?.language === 'he' ? 'he' : 'en';
  const other = match.players.find((_, playerIndex) => playerIndex !== index);
  const name = await pickSolverNickname(language, other?.displayName);
  match.players[index].displayName = name;
  await Match.updateOne(
    { _id: match._id },
    { $set: { [`players.${index}.displayName`]: name } }
  );
}

async function pickSolverNickname(language: Language, avoid?: string): Promise<string> {
  const blocked = avoid?.trim().toLocaleLowerCase();
  let last = generateThemedNickname(language);
  for (let attempt = 0; attempt < 6; attempt++) {
    const name = generateThemedNickname(language);
    last = name;
    if (blocked && name.toLocaleLowerCase() === blocked) {
      continue;
    }
    if (await isDisplayNameTaken(name)) {
      continue;
    }
    return name;
  }
  return last;
}

async function findReplay(
  puzzleId: mongoose.Types.ObjectId,
  excludeUserId: mongoose.Types.ObjectId
): Promise<ReplayCandidate | null> {
  const matches = await Match.find({
    puzzleId,
    status: MatchStatus.COMPLETED
  })
    .sort({ completedAt: -1 })
    .limit(40)
    .select('players moves startedAt completedAt durationSeconds endsAt')
    .lean();

  const candidates: ReplayCandidate[] = [];
  for (const match of matches) {
    if (!match.startedAt) {
      continue;
    }
    const startedAt = new Date(match.startedAt);
    const endedAt = new Date(
      match.completedAt
        ?? match.endsAt
        ?? startedAt.getTime() + (match.durationSeconds ?? MATCH_NORMAL_DURATION_SECONDS) * 1000
    );

    for (const player of match.players ?? []) {
      if (isGhostOpponentId(player.userId)) {
        continue;
      }
      if (String(player.userId) === excludeUserId.toString()) {
        continue;
      }
      const progress = player.progress ?? 0;
      if (progress <= 0 && !player.completedAt) {
        continue;
      }

      const moves = (match.moves ?? [])
        .filter(move => String(move.userId) === String(player.userId))
        .map(move => ({
          row: move.row,
          col: move.col,
          letter: move.letter,
          timestamp: new Date(move.timestamp)
        }));

      candidates.push({
        displayName: player.displayName || generateThemedNickname('en'),
        photoURL: player.photoURL || undefined,
        source: {
          startedAt,
          endedAt,
          playerCompletedAt: player.completedAt ? new Date(player.completedAt) : null,
          finalProgress: player.completedAt ? 100 : progress,
          moves
        }
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function rememberGame(
  match: IMatch,
  puzzle: IPuzzle,
  timing: { startedAt: Date; durationSeconds: number | null; endsAt: Date | null; timed: boolean }
): void {
  const gameState: GameState = {
    matchId: match._id.toString(),
    players: match.players.map(player => ({
      userId: player.userId.toString(),
      displayName: player.displayName,
      photoURL: player.photoURL,
      progress: 0,
      claimedCount: 0
    })),
    puzzleId: puzzle._id.toString(),
    moves: [],
    claimedWords: [],
    lockedCells: new Set<string>(),
    mode: MatchMode.NORMAL,
    ...timing
  };
  activeGames.set(match._id.toString(), gameState);
}

function syncActiveGame(
  matchId: string,
  ghostUserId: string,
  progress: number | undefined,
  finish: boolean,
  moves: Array<{ userId: mongoose.Types.ObjectId; row: number; col: number; letter: string; timestamp: Date }>
): void {
  const gameState = activeGames.get(matchId);
  if (!gameState) {
    return;
  }

  const player = gameState.players.find(entry => entry.userId === ghostUserId);
  if (player) {
    if (finish) {
      player.progress = 100;
    } else if (progress != null) {
      player.progress = progress;
    }
  }
  gameState.moves.push(...moves);
}
