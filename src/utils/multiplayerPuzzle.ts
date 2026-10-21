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
 * Which queue a linked board belongs to.
 * A Hebrew slot stays in the Hebrew queue. A Hebrew puzzle whose slot was saved
 * as English (the schema default) joins that queue too.
 */
export function poolLanguage(
  puzzleLanguage: unknown,
  slotLanguage: unknown
): Language {
  const slot = asLanguage(slotLanguage);
  const puzzle = asLanguage(puzzleLanguage);
  if (slot === 'he' || slot === 'he-en') return slot;
  if (puzzle === 'he' || puzzle === 'he-en') return puzzle;
  return 'en';
}

function asLanguage(value: unknown): Language | null {
  if (value === 'en' || value === 'he' || value === 'he-en') return value;
  return null;
}

/** Image answers that make one board feel like another. Whitespace is ignored. */
export function imageAnswerKey(answer: string): string {
  return answer.replace(/\s+/g, '');
}

/**
 * Boards to draw from. Recent boards are skipped while any other is eligible.
 * Among those, boards that repeat an image from a recent match are skipped
 * while any other board is eligible.
 */
export function variedPool(
  ids: readonly string[],
  avoid: ReadonlySet<string>,
  imagesById: ReadonlyMap<string, readonly string[]>
): string[] {
  if (ids.length === 0) return [];
  const fresh = ids.filter(id => !avoid.has(id));
  const base = fresh.length > 0 ? fresh : [...ids];

  const recentImages = new Set<string>();
  for (const id of ids) {
    if (!avoid.has(id)) continue;
    for (const image of imagesById.get(id) ?? []) recentImages.add(image);
  }
  if (recentImages.size === 0) return base;

  const varied = base.filter(id =>
    (imagesById.get(id) ?? []).every(image => !recentImages.has(image))
  );
  return varied.length > 0 ? varied : base;
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
  const imagesById = new Map(
    assigned.map(puzzle => [puzzle._id.toString(), imageAnswers(puzzle)])
  );
  const pool = variedPool(ids, avoid, imagesById);
  const fresh = ids.filter(id => !avoid.has(id)).length;
  console.log(
    `[PUZZLE] ${language} multiplayer pool ${pool.length} chosen from ${ids.length} linked` +
      ` (${fresh} not in the last ${RECENT_MATCHES} matches)`
  );

  const chosenId = choosePuzzleId(pool, new Set());
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

function imageAnswers(puzzle: IPuzzle): string[] {
  const keys: string[] = [];
  for (const item of puzzle.puzzleItems ?? []) {
    if (item.clueType !== 'image' || !item.answer) continue;
    keys.push(imageAnswerKey(item.answer));
  }
  return keys;
}

async function assignedPuzzles(language: Language): Promise<IPuzzle[]> {
  const assignments = await MultiplayerPuzzle.find().select('puzzleId language').lean();
  const slotLanguageByPuzzle = new Map<string, unknown>();
  const ids: mongoose.Types.ObjectId[] = [];
  for (const assignment of assignments) {
    const id = toObjectId(assignment.puzzleId);
    if (!id) continue;
    const key = id.toString();
    if (slotLanguageByPuzzle.has(key)) continue;
    slotLanguageByPuzzle.set(key, assignment.language);
    ids.push(id);
  }
  if (ids.length === 0) {
    return [];
  }

  const puzzles = await Puzzle.find({
    _id: { $in: ids },
    isActive: { $ne: false }
  });
  return puzzles.filter(
    puzzle => poolLanguage(puzzle.language, slotLanguageByPuzzle.get(String(puzzle._id))) === language
  );
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
    players: { $elemMatch: { userId: { $in: ids }, replay: { $ne: true } } },
    status: { $in: [MatchStatus.IN_PROGRESS, MatchStatus.COMPLETED] }
  })
    .sort({ createdAt: -1 })
    .limit(RECENT_MATCHES)
    .select('puzzleId')
    .lean();
  return new Set(matches.map(match => String(match.puzzleId)));
}
