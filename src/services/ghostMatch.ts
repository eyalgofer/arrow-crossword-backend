import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { GHOST_TICK_MS, MATCH_QUICK_DURATION_SECONDS } from '../constants/match';
import { Match, IMatch } from '../models/Match';
import { Puzzle, IPuzzle } from '../models/Puzzle';
import { activeGames } from '../sockets/activeGames';
import { GameState, Language, MatchCompletionReason, MatchMode, MatchStatus, OpponentKind } from '../types';
import { pickMultiplayerPuzzle } from '../utils/multiplayerPuzzle';
import { toObjectId } from '../utils/objectId';
import { createMatchTiming, serializeTimingFields } from '../utils/matchTiming';
import { isQuickMatch } from '../utils/matchSettings';
import { generateThemedNickname, ghostOpponentObjectId, isGhostOpponentId, isReplaySeat } from '../utils/ghost';
import { isDisplayNameTaken } from '../utils/displayName';
import { buildReplayClaimSchedule, buildSolverClaimSchedule, ReplayClaimSource } from './ghostSchedule';
import { completeMatch, completeMatchIfBoardClaimed } from './matchCompletion';
import {
  clueIdForItem,
  lockedCellsFromClaims,
  playerClaimScores,
  SerializedClaimedWord,
  serializeClaimedWords,
  tryClaimWord
} from './wordClaims';

interface ReplayCandidate {
  userId: mongoose.Types.ObjectId;
  displayName: string;
  photoURL?: string;
  source: ReplayClaimSource;
}

/** Nicknames are UI-locale only; he-en packs use Hebrew names. */
function nicknameLanguage(language: Language): 'en' | 'he' {
  return language === 'he' || language === 'he-en' ? 'he' : 'en';
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
  stillSearching: () => boolean = () => true,
  coins?: number
): Promise<void> {
  const socket = io.sockets.sockets.get(socketId);
  const fail = (message: string) => {
    socket?.emit('error', { message });
  };

  const picked = await pickMultiplayerPuzzle(language, [user._id]);
  if (!stillSearching()) {
    return;
  }
  if (!picked) {
    fail('No multiplayer puzzles configured');
    return;
  }

  const replay = await findReplay(picked.puzzleId, user._id);
  const settings = { mode: MatchMode.QUICK, timed: true as const };
  const timing = createMatchTiming(settings);
  const durationMs = (timing.durationSeconds ?? MATCH_QUICK_DURATION_SECONDS) * 1000;
  const claimEvents = replay ? buildReplayClaimSchedule(replay.source, durationMs) : [];
  const clues = picked.puzzle.puzzleItems
    .filter(item => typeof item.answer === 'string' && item.answer.trim().length > 0)
    .map(item => ({ clueId: clueIdForItem(item), answer: item.answer }));
  const solverEvents = buildSolverClaimSchedule(
    durationMs,
    Date.now() ^ user._id.getTimestamp().getTime(),
    clues
  );
  const schedule = claimEvents.length > 0 ? claimEvents : solverEvents;
  const kind: OpponentKind = claimEvents.length > 0 ? 'replay' : 'solver';
  if (!stillSearching()) {
    return;
  }

  const ghostId = ghostOpponentObjectId();
  const seatId = kind === 'replay' && replay ? replay.userId : ghostId;
  const displayName = kind === 'replay' && replay?.displayName
    ? replay.displayName
    : await pickSolverNickname(nicknameLanguage(language), user.displayName);
  const opponent = {
    userId: seatId.toString(),
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
        userId: seatId,
        displayName: opponent.displayName,
        photoURL: opponent.photoURL,
        progress: 0,
        claimedCount: 0,
        ...(kind === 'replay' ? { replay: true } : {})
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
    stake: 0,
    pot: 0,
    boosts: [],
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
    stake: 0,
    ...(coins == null ? {} : { coins }),
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

  if (isQuickMatch(match)) {
    await advanceQuickGhost(io, match, options);
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

/** Quick ghosts claim words. Progress and cell moves do not lock cells or score. */
async function advanceQuickGhost(
  io: Server,
  match: IMatch,
  options?: { emit?: boolean }
): Promise<void> {
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

  const due = events
    .slice(cursor, next)
    .filter(event => event.type === 'claim' && event.clueId && event.answer);
  const seat = ghostSeat(match);
  const puzzle = due.length > 0 && seat ? await Puzzle.findById(match.puzzleId) : null;
  if (due.length > 0 && seat && !puzzle) {
    return;
  }

  let latest = match;
  let claimed = false;
  if (seat && puzzle) {
    for (const event of due) {
      const result = await tryClaimWord({
        match: latest,
        puzzle,
        userId: seat.userId,
        displayName: seat.displayName,
        clueId: event.clueId as string,
        answer: event.answer as string
      });
      if (!result.ok) {
        if (result.error === 'Match is over') {
          break;
        }
        continue;
      }
      latest = result.match;
      claimed = true;
      syncClaimedGame(latest, puzzle);
      if (options?.emit !== false) {
        emitWordClaimed(io, latest, puzzle, result.claim);
      }
    }
  }

  await Match.updateOne(
    { _id: match._id, ghostApplied: cursor },
    { $set: { ghostApplied: next } }
  );

  if (claimed && puzzle) {
    await completeMatchIfBoardClaimed(io, latest, puzzle.puzzleItems.length);
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
  const language = nicknameLanguage(
    puzzle?.language === 'he' || puzzle?.language === 'he-en' ? 'he' : 'en'
  );
  const other = match.players.find((_, playerIndex) => playerIndex !== index);
  const name = await pickSolverNickname(language, other?.displayName);
  match.players[index].displayName = name;
  await Match.updateOne(
    { _id: match._id },
    { $set: { [`players.${index}.displayName`]: name } }
  );
}

async function pickSolverNickname(language: 'en' | 'he', avoid?: string): Promise<string> {
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
    status: MatchStatus.COMPLETED,
    mode: MatchMode.QUICK,
    'claimedWords.0': { $exists: true }
  })
    .sort({ completedAt: -1 })
    .limit(40)
    .select('players claimedWords startedAt')
    .lean();

  const candidates: ReplayCandidate[] = [];
  for (const match of matches) {
    if (!match.startedAt) {
      continue;
    }
    const startedAt = new Date(match.startedAt);

    for (const player of match.players ?? []) {
      if (isReplaySeat(player) || isGhostOpponentId(player.userId)) {
        continue;
      }
      if (String(player.userId) === excludeUserId.toString()) {
        continue;
      }

      const claims = (match.claimedWords ?? [])
        .filter(word => String(word.userId) === String(player.userId))
        .filter(word => word.clueId && word.answer)
        .map(word => ({
          clueId: word.clueId,
          answer: word.answer,
          claimedAt: new Date(word.claimedAt)
        }));
      if (claims.length === 0) {
        continue;
      }

      const userId = toObjectId(player.userId);
      if (!userId) {
        continue;
      }
      candidates.push({
        userId,
        displayName: player.displayName || generateThemedNickname('en'),
        photoURL: player.photoURL || undefined,
        source: { startedAt, claims }
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function ghostSeat(match: IMatch): IMatch['players'][number] | undefined {
  return match.players.find(player => isReplaySeat(player))
    ?? match.players.find(player => isGhostOpponentId(player.userId));
}

function emitWordClaimed(
  io: Server,
  match: IMatch,
  puzzle: IPuzzle,
  claim: SerializedClaimedWord
): void {
  const scores = playerClaimScores(match.players, puzzle.puzzleItems.length);
  io.to(match._id.toString()).emit('word_claimed', {
    matchId: match._id.toString(),
    clueId: claim.clueId,
    answer: claim.answer,
    userId: claim.userId,
    displayName: claim.displayName,
    claimedAt: claim.claimedAt,
    scores,
    claimedWords: serializeClaimedWords(match.claimedWords)
  });
}

function syncClaimedGame(match: IMatch, puzzle: IPuzzle): void {
  const gameState = activeGames.get(match._id.toString());
  if (!gameState) {
    return;
  }

  const scores = playerClaimScores(match.players, puzzle.puzzleItems.length);
  gameState.claimedWords = match.claimedWords || [];
  gameState.lockedCells = lockedCellsFromClaims(puzzle, match.claimedWords);
  gameState.players = gameState.players.map(player => {
    const score = scores.find(entry => entry.userId === player.userId);
    return {
      ...player,
      claimedCount: score?.claimedCount ?? player.claimedCount ?? 0,
      progress: score?.progress ?? player.progress
    };
  });
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
    mode: match.mode === MatchMode.QUICK ? MatchMode.QUICK : MatchMode.NORMAL,
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
