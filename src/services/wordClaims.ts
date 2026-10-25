import mongoose from 'mongoose';
import { IMatch, IMatchPlayer } from '../models/Match';
import { Match } from '../models/Match';
import { MatchWordClaim } from '../models/MatchWordClaim';
import { IPuzzle } from '../models/Puzzle';
import { ClaimedWord, MatchStatus, PuzzleItem } from '../types';
import { answersMatch } from '../utils/answer';
import { toIdString, toObjectId } from '../utils/objectId';

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

export function answerCellsForItem(item: PuzzleItem): Array<{ row: number; col: number }> {
  const letters = (item.answer ?? '').replace(/[\s\-–—]+/g, '');
  const anchorRow = item.clueType === 'image' && item.exitRow != null && item.exitCol != null
    ? item.exitRow
    : item.startRow;
  const anchorCol = item.clueType === 'image' && item.exitRow != null && item.exitCol != null
    ? item.exitCol
    : item.startCol;
  const cells: Array<{ row: number; col: number }> = [];

  for (let i = 0; i < letters.length; i++) {
    let row = anchorRow;
    let col = anchorCol;
    switch (item.direction) {
      case 'across':
        row = anchorRow;
        col = anchorCol + 1 + i;
        break;
      case 'down':
        row = anchorRow + 1 + i;
        col = anchorCol;
        break;
      case 'right-down':
        row = anchorRow + i;
        col = anchorCol + 1;
        break;
      case 'down-across':
        row = anchorRow + 1;
        col = anchorCol + i;
        break;
      case 'left-down':
        row = anchorRow + i;
        col = anchorCol - 1;
        break;
      case 'up-across':
        row = anchorRow - 1;
        col = anchorCol + i;
        break;
    }
    cells.push({ row, col });
  }

  return cells;
}

export function lockedCellsFromClaims(
  puzzle: IPuzzle,
  claimedWords: ClaimedWord[] | undefined
): Set<string> {
  const keys = new Set<string>();
  for (const word of claimedWords ?? []) {
    const item = findPuzzleItem(puzzle, word.clueId);
    if (!item) {
      continue;
    }
    for (const cell of answerCellsForItem(item)) {
      keys.add(`${cell.row},${cell.col}`);
    }
  }
  return keys;
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
  const iso = Number.isNaN(claimedAt.getTime()) ? new Date().toISOString() : claimedAt.toISOString();

  return {
    clueId: word.clueId,
    answer: word.answer,
    userId: toIdString(word.userId) ?? '',
    displayName: word.displayName,
    claimedAt: iso
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
  const claimer = match.players.find(player => toIdString(player.userId) === userId.toString());
  if (!claimer) {
    return { ok: false, error: 'Not in this match' };
  }
  if (claimer.left === true) {
    return { ok: false, error: 'You left this match' };
  }

  const item = findPuzzleItem(puzzle, clueId);

  if (!item || typeof item.answer !== 'string' || item.answer.trim().length === 0) {
    return { ok: false, error: 'Invalid clue' };
  }

  if (!answersMatch(answer, item.answer)) {
    return { ok: false, error: 'Incorrect answer' };
  }

  const claimedAt = new Date();
  const officialAnswer = item.answer;
  const officialClueId = clueIdForItem(item);
  const claimerId = userId.toString();
  const nextCount = (claimer.claimedCount ?? 0) + 1;

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

  let updated: IMatch | null;
  try {
    updated = await Match.findOneAndUpdate(
      {
        _id: match._id,
        status: MatchStatus.IN_PROGRESS,
        'claimedWords.clueId': { $ne: officialClueId }
      },
      {
        $push: { claimedWords: claimDoc },
        $inc: { 'players.$[player].claimedCount': 1 },
        $set: { 'players.$[player].progress': claimProgress(nextCount, totalClues) }
      },
      {
        // A string casts cleanly. An ObjectId is an object whose `_id` is itself.
        arrayFilters: [{ 'player.userId': claimerId }],
        new: true
      }
    );
  } catch (error) {
    await MatchWordClaim.deleteOne({ matchId: match._id, clueId: officialClueId });
    throw error;
  }

  if (!updated) {
    await MatchWordClaim.deleteOne({ matchId: match._id, clueId: officialClueId });
    const latest = await Match.findById(match._id);
    if (!latest || latest.status !== MatchStatus.IN_PROGRESS) {
      return { ok: false, error: 'Match is over' };
    }
    return { ok: false, error: 'Word already claimed' };
  }

  return {
    ok: true,
    match: updated,
    claim: serializeClaimedWord(claimDoc)
  };
}

const FINISHED_CLAIM_BATCH = 200;

/** Drops the first-write lock rows once the match no longer needs them. */
export async function clearMatchWordClaims(
  matchId: mongoose.Types.ObjectId | string | Array<mongoose.Types.ObjectId | string>
): Promise<void> {
  const matchIds = Array.isArray(matchId) ? matchId : [matchId];
  if (matchIds.length === 0) {
    return;
  }
  await MatchWordClaim.deleteMany({ matchId: { $in: matchIds } });
}

/**
 * Removes claim rows for matches that are no longer in progress, including
 * rows whose match document is already gone. In-progress rows stay, so a
 * claim that is still the first-write lock is not deleted.
 */
export async function clearFinishedMatchWordClaims(): Promise<number> {
  let removed = 0;
  let after: mongoose.Types.ObjectId | undefined;

  for (;;) {
    const page = await MatchWordClaim.find(after ? { _id: { $gt: after } } : {})
      .sort({ _id: 1 })
      .limit(FINISHED_CLAIM_BATCH)
      .select('_id matchId')
      .lean();

    if (page.length === 0) {
      break;
    }

    after = page[page.length - 1]._id;
    const matchIds = [...new Set(page.map(row => row.matchId.toString()))];
    const live = await Match.find({
      _id: { $in: matchIds },
      status: MatchStatus.IN_PROGRESS
    }).select('_id').lean();
    const liveIds = new Set(live.map(match => match._id.toString()));
    const finished = matchIds.filter(id => !liveIds.has(id));

    if (finished.length > 0) {
      const result = await MatchWordClaim.deleteMany({ matchId: { $in: finished } });
      removed += result.deletedCount ?? 0;
    }

    if (page.length < FINISHED_CLAIM_BATCH) {
      break;
    }
  }

  return removed;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 11000;
}
