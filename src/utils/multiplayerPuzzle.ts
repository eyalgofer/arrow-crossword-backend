import mongoose from 'mongoose';
import { Match } from '../models/Match';
import { MultiplayerPuzzle } from '../models/MultiplayerPuzzle';
import { Puzzle, IPuzzle } from '../models/Puzzle';
import { Language, MatchStatus } from '../types';
import { languageFilter } from './language';
import { toObjectId } from './objectId';

const RECENT_MATCHES = 30;

export interface PickedMultiplayerPuzzle {
  puzzle: IPuzzle;
  puzzleId: mongoose.Types.ObjectId;
}

/**
 * Uniform pick. Recent ids are skipped while any other board is eligible.
 * If every board was just played, one of them is still returned.
 */
export function choosePuzzleId(
  ids: readonly string[],
  avoid: ReadonlySet<string>,
  random: () => number = Math.random
): string | null {
  if (ids.length === 0) {
    return null;
  }
  const fresh = ids.filter(id => !avoid.has(id));
  const pool = fresh.length > 0 ? fresh : [...ids];
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index] ?? null;
}

export async function pickMultiplayerPuzzle(
  language: Language,
  avoidUserIds: readonly unknown[] = []
): Promise<PickedMultiplayerPuzzle | null> {
  const avoid = await recentPuzzleIds(avoidUserIds);
  const picked = await pickForLanguage(language, avoid);
  if (picked) {
    return picked;
  }
  if (language !== 'en') {
    return pickForLanguage('en', avoid);
  }
  return null;
}

async function pickForLanguage(
  language: Language,
  avoid: ReadonlySet<string>
): Promise<PickedMultiplayerPuzzle | null> {
  const assigned = await assignedPuzzles(language);
  const ids = assigned.map(puzzle => puzzle._id.toString());
  const eligible = ids.filter(id => !avoid.has(id)).length;
  console.log(
    `[PUZZLE] ${language} multiplayer pool ${eligible} eligible of ${assigned.length} assigned` +
      ` (${avoid.size} recent skipped)`
  );

  const chosenId = choosePuzzleId(ids, avoid);
  const chosen = chosenId ? assigned.find(puzzle => puzzle._id.toString() === chosenId) : undefined;
  if (chosen) {
    return { puzzle: chosen, puzzleId: chosen._id };
  }

  const sampled = await sampleActivePuzzle(language, avoid);
  if (!sampled) {
    return null;
  }
  console.log(`[PUZZLE] ${language} multiplayer fallback sample ${sampled._id.toString()}`);
  return { puzzle: sampled, puzzleId: sampled._id };
}

async function assignedPuzzles(language: Language): Promise<IPuzzle[]> {
  const assignments = await MultiplayerPuzzle.find({ language: languageFilter(language) })
    .select('puzzleId')
    .lean();
  const ids = assignments
    .map(assignment => assignment.puzzleId)
    .filter((id): id is mongoose.Types.ObjectId => id != null);
  if (ids.length === 0) {
    return [];
  }
  return Puzzle.find({
    _id: { $in: ids },
    isActive: { $ne: false }
  });
}

async function sampleActivePuzzle(
  language: Language,
  avoid: ReadonlySet<string>
): Promise<IPuzzle | null> {
  const sampled = await sampleOne(language, avoid);
  if (sampled || avoid.size === 0) {
    return sampled;
  }
  return sampleOne(language, new Set());
}

async function sampleOne(
  language: Language,
  avoid: ReadonlySet<string>
): Promise<IPuzzle | null> {
  const match: Record<string, unknown> = {
    isActive: { $ne: false },
    language: languageFilter(language)
  };
  const skipped = [...avoid]
    .map(id => toObjectId(id))
    .filter((id): id is mongoose.Types.ObjectId => id != null);
  if (skipped.length > 0) {
    match._id = { $nin: skipped };
  }
  const rows = await Puzzle.aggregate<{ _id: mongoose.Types.ObjectId }>([
    { $match: match },
    { $sample: { size: 1 } }
  ]);
  const id = rows[0]?._id;
  if (!id) {
    return null;
  }
  return Puzzle.findById(id);
}

async function recentPuzzleIds(userIds: readonly unknown[]): Promise<Set<string>> {
  const ids = userIds
    .map(id => toObjectId(id))
    .filter((id): id is mongoose.Types.ObjectId => id != null);
  if (ids.length === 0) {
    return new Set();
  }
  const matches = await Match.find({
    'players.userId': { $in: ids },
    status: { $in: [MatchStatus.IN_PROGRESS, MatchStatus.COMPLETED] }
  })
    .sort({ createdAt: -1 })
    .limit(RECENT_MATCHES)
    .select('puzzleId')
    .lean();
  return new Set(matches.map(match => String(match.puzzleId)));
}
