import mongoose from 'mongoose';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { Match } from '../models/Match';
import { MultiplayerPuzzle } from '../models/MultiplayerPuzzle';
import { Puzzle, IPuzzle } from '../models/Puzzle';
import { Language, MatchStatus } from '../types';
import { isBeforeLiveDailyKey } from './dailyClock';
import { languageFilter } from './language';
import { toObjectId } from './objectId';

/** Per player, so one busy opponent cannot crowd the other out of the window. */
const HISTORY_MATCHES = 200;

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
 * How recently this board, or any image on it, was shown to these players.
 * Zero means neither the board nor its images appear in their history.
 */
export function exposureOf(
  id: string,
  images: readonly string[],
  seenBoards: ReadonlyMap<string, number>,
  seenImages: ReadonlyMap<string, number>
): number {
  let at = seenBoards.get(id) ?? 0;
  for (const image of images) {
    const seen = seenImages.get(image) ?? 0;
    if (seen > at) at = seen;
  }
  return at;
}

/**
 * Uniform among the boards seen least recently. An unseen board (exposure 0)
 * beats one that only repeats an image the players already saw. When every
 * board repeats something, the one exposed longest ago wins.
 */
export function chooseLeastExposed(
  ids: readonly string[],
  imagesById: ReadonlyMap<string, readonly string[]>,
  seenBoards: ReadonlyMap<string, number>,
  seenImages: ReadonlyMap<string, number>,
  random: () => number = Math.random
): string | null {
  if (ids.length === 0) return null;
  let best = Infinity;
  const tied: string[] = [];
  for (const id of ids) {
    const score = exposureOf(id, imagesById.get(id) ?? [], seenBoards, seenImages);
    if (score < best) {
      best = score;
      tied.length = 0;
      tied.push(id);
    } else if (score === best) {
      tied.push(id);
    }
  }
  const index = Math.min(tied.length - 1, Math.floor(random() * tied.length));
  return tied[index] ?? null;
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

interface PlayerExposure {
  boards: Map<string, number>;
  images: Map<string, number>;
}

export async function pickMultiplayerPuzzle(
  language: Language,
  avoidUserIds: readonly unknown[] = []
): Promise<PickedMultiplayerPuzzle | null> {
  const exposure = await playerExposure(avoidUserIds);
  const picked = await pickForLanguage(language, exposure);
  if (picked) {
    return picked;
  }
  if (language !== 'en') {
    return pickForLanguage('en', exposure);
  }
  return null;
}

async function pickForLanguage(
  language: Language,
  exposure: PlayerExposure
): Promise<PickedMultiplayerPuzzle | null> {
  const slots = await assignedPuzzles(language);
  const past = await pastDailyPuzzles(language);
  const byId = new Map<string, IPuzzle>();
  for (const puzzle of slots) byId.set(puzzle._id.toString(), puzzle);
  let dailyAdded = 0;
  for (const puzzle of past) {
    const key = puzzle._id.toString();
    if (byId.has(key)) continue;
    byId.set(key, puzzle);
    dailyAdded += 1;
  }

  const assigned = [...byId.values()];
  const ids = assigned.map(puzzle => puzzle._id.toString());
  const imagesById = new Map(
    assigned.map(puzzle => [puzzle._id.toString(), imageAnswers(puzzle)])
  );
  const unseen = ids.filter(
    id => exposureOf(id, imagesById.get(id) ?? [], exposure.boards, exposure.images) === 0
  ).length;
  console.log(
    `[PUZZLE] ${language} pool ${ids.length} from ${slots.length} slots and ${dailyAdded} past dailies` +
      ` (${unseen} unseen)`
  );

  const chosenId = chooseLeastExposed(ids, imagesById, exposure.boards, exposure.images);
  const chosen = chosenId ? byId.get(chosenId) : undefined;
  if (chosen) {
    return { puzzle: chosen, puzzleId: chosen._id };
  }

  const sampled = await sampleActivePuzzle(language, new Set(exposure.boards.keys()));
  if (!sampled) {
    return null;
  }
  console.log(`[PUZZLE] ${language} multiplayer fallback sample ${sampled._id.toString()}`);
  return { puzzle: sampled, puzzleId: sampled._id };
}

function imageAnswers(puzzle: {
  puzzleItems?: Array<{ clueType?: string | null; answer?: string | null }> | null;
}): string[] {
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

/** Dailies whose date is already over. Today and anything still scheduled stay out. */
async function pastDailyPuzzles(language: Language): Promise<IPuzzle[]> {
  const rows = await DailyPuzzle.find({ language: languageFilter(language) })
    .select('puzzleId year dayOfYear')
    .lean();
  const ids: mongoose.Types.ObjectId[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!isBeforeLiveDailyKey(row.year, row.dayOfYear)) continue;
    const id = toObjectId(row.puzzleId);
    if (!id) continue;
    const key = id.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(id);
  }
  if (ids.length === 0) return [];
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

function seenAt(value: unknown): number {
  const at = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  return Number.isFinite(at) && at > 0 ? at : 1;
}

async function playerExposure(userIds: readonly unknown[]): Promise<PlayerExposure> {
  const boards = new Map<string, number>();
  const images = new Map<string, number>();
  const ids: mongoose.Types.ObjectId[] = [];
  const seenUsers = new Set<string>();
  for (const userId of userIds) {
    const id = toObjectId(userId);
    if (!id) continue;
    const key = id.toString();
    if (seenUsers.has(key)) continue;
    seenUsers.add(key);
    ids.push(id);
  }
  if (ids.length === 0) return { boards, images };

  const perPlayer = await Promise.all(ids.map(id =>
    Match.find({
      players: { $elemMatch: { userId: id, replay: { $ne: true } } },
      status: { $in: [MatchStatus.IN_PROGRESS, MatchStatus.COMPLETED] }
    })
      .sort({ createdAt: -1 })
      .limit(HISTORY_MATCHES)
      .select('puzzleId createdAt')
      .lean()
  ));

  for (const matches of perPlayer) {
    for (const match of matches) {
      const puzzleId = String(match.puzzleId);
      const at = seenAt(match.createdAt);
      const prev = boards.get(puzzleId) ?? 0;
      if (at > prev) boards.set(puzzleId, at);
    }
  }

  const playedIds = [...boards.keys()]
    .map(id => toObjectId(id))
    .filter((id): id is mongoose.Types.ObjectId => id != null);
  if (playedIds.length === 0) return { boards, images };

  const played = await Puzzle.find({ _id: { $in: playedIds } })
    .select('puzzleItems.clueType puzzleItems.answer')
    .lean();
  for (const puzzle of played) {
    const at = boards.get(String(puzzle._id)) ?? 0;
    if (at <= 0) continue;
    for (const image of imageAnswers(puzzle)) {
      const prev = images.get(image) ?? 0;
      if (at > prev) images.set(image, at);
    }
  }
  return { boards, images };
}
