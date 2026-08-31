import mongoose from 'mongoose';
import { IMatch, IMatchPlayer } from '../models/Match';
import { Match } from '../models/Match';
import { MatchWordClaim } from '../models/MatchWordClaim';
import { IPuzzle } from '../models/Puzzle';
import { ClaimedWord, MatchStatus, PuzzleItem } from '../types';
import { answersMatch } from '../utils/answer';

export interface SerializedClaimedWord {
  clueId: string;
  answer: string;
  userId: string;
  displayName: string;
  claimedAt: string;
}

export interface PlayerClaimScore {
  userId: string;
  claimedCount: number;
  progress: number;
}

export function clueIdForItem(item: Pick<PuzzleItem, 'number' | 'direction'>): string {
  return `${item.number}|${item.direction}`;
}

export function parseClueId(clueId: string): { number: number; direction: string } | null {
  if (typeof clueId !== 'string') {
    return null;
  }

  const separator = clueId.indexOf('|');
  if (separator <= 0 || separator === clueId.length - 1) {
    return null;
  }

  const number = Number.parseInt(clueId.slice(0, separator), 10);
  const direction = clueId.slice(separator + 1).toLowerCase();
  if (!Number.isFinite(number) || !direction) {
    return null;
  }

  return { number, direction };
}

export function findPuzzleItem(puzzle: IPuzzle, clueId: string): PuzzleItem | undefined {
  const parsed = parseClueId(clueId);
  if (!parsed) {
    return undefined;
  }

  return puzzle.puzzleItems.find(
    item => item.number === parsed.number && item.direction === parsed.direction
  );
}

export function claimProgress(claimedCount: number, totalClues: number): number {
  if (totalClues <= 0) {
    return 0;
  }
  return Math.round((claimedCount / totalClues) * 100);
}

export function winnerIdFromClaimedCount(
  players: IMatchPlayer[]
): mongoose.Types.ObjectId | null {
  if (players.length === 0) {
    return null;
  }

  const anyClaims = players.some(player => (player.claimedCount ?? 0) > 0);
  const scoreOf = (player: IMatchPlayer) =>
    anyClaims ? (player.claimedCount ?? 0) : (player.progress ?? 0);

  let best = players[0];
  let tied = false;

  for (let i = 1; i < players.length; i++) {
    const player = players[i];
    const playerScore = scoreOf(player);
    const bestScore = scoreOf(best);
    if (playerScore > bestScore) {
      best = player;
      tied = false;
    } else if (playerScore === bestScore) {
      tied = true;
    }
  }

  return tied ? null : toObjectId(best.userId);
}

export function isBoardFullyClaimed(match: IMatch, totalClues: number): boolean {
  return totalClues > 0 && (match.claimedWords?.length ?? 0) >= totalClues;
}

export function serializeClaimedWord(word: ClaimedWord): SerializedClaimedWord {
  const claimedAt = word.claimedAt instanceof Date
    ? word.claimedAt
    : new Date(word.claimedAt);

  return {
    clueId: word.clueId,
    answer: word.answer,
    userId: toIdString(word.userId) ?? '',
    displayName: word.displayName,
    claimedAt: claimedAt.toISOString()
  };
}

export function serializeClaimedWords(words: ClaimedWord[] | undefined): SerializedClaimedWord[] {
  return (words ?? []).map(serializeClaimedWord);
}

export function playerClaimScores(
  players: IMatchPlayer[],
  totalClues: number
): PlayerClaimScore[] {
  return players.map(player => {
    const claimedCount = player.claimedCount ?? 0;
    return {
      userId: toIdString(player.userId) ?? '',
      claimedCount,
      progress: claimProgress(claimedCount, totalClues)
    };
  });
}

export function applyClaimScores(match: IMatch, totalClues: number): boolean {
  let changed = false;
  const counts = new Map<string, number>();

  for (const word of match.claimedWords ?? []) {
    const userId = toIdString(word.userId);
    if (!userId) {
      continue;
    }
    counts.set(userId, (counts.get(userId) ?? 0) + 1);
  }

  for (const player of match.players) {
    const userId = toIdString(player.userId) ?? '';
    const claimedCount = counts.get(userId) ?? 0;
    const progress = claimProgress(claimedCount, totalClues);
    if ((player.claimedCount ?? 0) !== claimedCount) {
      player.claimedCount = claimedCount;
      changed = true;
    }
    if ((player.progress ?? 0) !== progress) {
      player.progress = progress;
      changed = true;
    }
  }

  return changed;
}

export async function recomputeMatchScores(
  match: IMatch,
  totalClues: number
): Promise<IMatch> {
  if (applyClaimScores(match, totalClues)) {
    await match.save();
  }
  return match;
}

export async function tryClaimWord(options: {
  match: IMatch;
  puzzle: IPuzzle;
  userId: mongoose.Types.ObjectId;
  displayName: string;
  clueId: string;
  answer: string;
}): Promise<
  | { ok: true; match: IMatch; claim: SerializedClaimedWord }
  | { ok: false; error: string }
> {
  const { match, puzzle, userId, displayName, clueId, answer } = options;
  const totalClues = puzzle.puzzleItems.length;
  const item = findPuzzleItem(puzzle, clueId);

  if (!item) {
    return { ok: false, error: 'Invalid clue' };
  }

  if (!answersMatch(answer, item.answer)) {
    return { ok: false, error: 'Incorrect answer' };
  }

  const claimedAt = new Date();
  const officialAnswer = item.answer;
  const officialClueId = clueIdForItem(item);

  try {
    await MatchWordClaim.create({
      matchId: match._id,
      clueId: officialClueId,
      answer: officialAnswer,
      userId,
      displayName,
      claimedAt
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { ok: false, error: 'Word already claimed' };
    }
    throw error;
  }

  const claimDoc = {
    clueId: officialClueId,
    answer: officialAnswer,
    userId,
    displayName,
    claimedAt
  };

  const updated = await Match.findOneAndUpdate(
    {
      _id: match._id,
      status: MatchStatus.IN_PROGRESS,
      'claimedWords.clueId': { $ne: officialClueId }
    },
    {
      $push: { claimedWords: claimDoc },
      $inc: { 'players.$[player].claimedCount': 1 }
    },
    {
      arrayFilters: [{ 'player.userId': userId }],
      new: true
    }
  );

  if (!updated) {
    const latest = await Match.findById(match._id);
    if (!latest || latest.status !== MatchStatus.IN_PROGRESS) {
      return { ok: false, error: 'Match is over' };
    }
    return { ok: false, error: 'Word already claimed' };
  }

  applyClaimScores(updated, totalClues);
  if (updated.isModified()) {
    await updated.save();
  }

  return {
    ok: true,
    match: updated,
    claim: serializeClaimedWord(claimDoc)
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 11000;
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
