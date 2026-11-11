import { Puzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { Language, PuzzleItem } from '../types';
import { toIdString } from '../utils/objectId';

/**
 * Clue numbers that start solved on the first Hebrew puzzle.
 * The English board is unchanged. Numbers are unique on a board;
 * direction is read from that puzzle.
 */
export const FIRST_PUZZLE_STARTER_CLUE_NUMBERS = [
  3, 4, 7, 8, 10, 11, 17, 21, 28, 34, 40, 41, 44, 54, 56, 57, 64,
] as const;

const PACKAGE_CACHE_MS = 60_000;

export interface PackageSlot {
  language?: string | null;
  order: number;
  puzzleIds: string[];
}

export interface HeadStart {
  puzzleId: string;
  starterIds: string[];
  totalClues: number;
}

type ClueItem = Pick<PuzzleItem, 'number' | 'direction'>;

let packageCache: { at: number; slots: PackageSlot[] } | null = null;
const warnedIncomplete = new Set<string>();

export function starterClueIds(items: readonly ClueItem[]): string[] {
  const wanted = new Set<number>(FIRST_PUZZLE_STARTER_CLUE_NUMBERS);
  const ids: string[] = [];
  for (const item of items) {
    if (!wanted.has(item.number)) continue;
    ids.push(`${item.number}|${item.direction}`);
  }
  return ids;
}

/** Saved solves first, then any starter clues the client did not send. */
export function withStarterClues(
  saved: readonly string[] | undefined,
  isCompleted: boolean,
  starterIds: readonly string[]
): string[] {
  const base = saved ? [...saved] : [];
  if (isCompleted || starterIds.length === 0) return base;
  const seen = new Set(base);
  for (const id of starterIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    base.push(id);
  }
  return base;
}

export function applyStarterClues(opts: {
  completedClueIds?: readonly string[];
  completedCluesCount?: number;
  isCompleted?: boolean;
  starterIds: readonly string[];
}): { completedClueIds: string[]; completedCluesCount: number } {
  const completedClueIds = withStarterClues(
    opts.completedClueIds,
    opts.isCompleted === true,
    opts.starterIds
  );
  const completedCluesCount = opts.isCompleted
    ? (opts.completedCluesCount ?? completedClueIds.length)
    : Math.max(opts.completedCluesCount ?? 0, completedClueIds.length);
  return { completedClueIds, completedCluesCount };
}

export function puzzleProgressPercent(opts?: {
  isCompleted?: boolean;
  completedClueIds?: readonly string[];
  completedCluesCount?: number;
  totalClues?: number;
  starterIds?: readonly string[];
}): number {
  if (!opts) return 0;
  if (opts.isCompleted) return 100;
  const ids = withStarterClues(opts.completedClueIds, false, opts.starterIds ?? []);
  const total = opts.totalClues ?? 0;
  if (total <= 0) return 0;
  const count = Math.max(opts.completedCluesCount ?? 0, ids.length);
  if (count <= 0) return 0;
  return Math.round((count / total) * 100);
}

function packageLanguage(pkg: PackageSlot): Language {
  return (pkg.language || 'en') as Language;
}

/** English stays blank. Hebrew and Hebrew-from-English packs get the head start. */
export function languageUsesStarterClues(language: Language): boolean {
  return language !== 'en';
}

function lowestOpeningPackage(
  puzzleId: string,
  packages: readonly PackageSlot[]
): PackageSlot | null {
  let match: PackageSlot | null = null;
  for (const pkg of packages) {
    if (pkg.puzzleIds[0] !== puzzleId) continue;
    if (!match || pkg.order < match.order) match = pkg;
  }
  if (!match) return null;
  const language = packageLanguage(match);
  const hasEarlier = packages.some(
    pkg => packageLanguage(pkg) === language && pkg.order < match.order
  );
  return hasEarlier ? null : match;
}

export function isFirstPackagePuzzle(puzzleId: string, packages: readonly PackageSlot[]): boolean {
  return lowestOpeningPackage(puzzleId, packages) != null;
}

export function receivesStarterClues(puzzleId: string, packages: readonly PackageSlot[]): boolean {
  const match = lowestOpeningPackage(puzzleId, packages);
  return match != null && languageUsesStarterClues(packageLanguage(match));
}

export function firstPackagePuzzleId(
  language: Language,
  packages: readonly PackageSlot[]
): string | null {
  let match: PackageSlot | null = null;
  for (const pkg of packages) {
    const pkgLanguage = (pkg.language || 'en') as Language;
    if (pkgLanguage !== language) continue;
    if (!pkg.puzzleIds[0]) continue;
    if (!match || pkg.order < match.order) match = pkg;
  }
  return match?.puzzleIds[0] ?? null;
}

async function packageSlots(): Promise<PackageSlot[]> {
  const now = Date.now();
  if (packageCache && now - packageCache.at < PACKAGE_CACHE_MS) {
    return packageCache.slots;
  }
  const packages = await PuzzlePackage.find()
    .select('language order puzzleIds')
    .lean();
  const slots = packages.map(pkg => ({
    language: pkg.language,
    order: pkg.order,
    puzzleIds: (pkg.puzzleIds ?? [])
      .map(id => toIdString(id))
      .filter((id): id is string => id != null),
  }));
  packageCache = { at: now, slots };
  return slots;
}

function warnIfStarterCluesMissing(puzzleId: string, ids: string[]): void {
  const expected = FIRST_PUZZLE_STARTER_CLUE_NUMBERS.length;
  if (ids.length === expected || warnedIncomplete.has(puzzleId)) return;
  warnedIncomplete.add(puzzleId);
  console.warn(
    `First puzzle ${puzzleId} has ${ids.length} of ${expected} starter clues`
  );
}

export async function starterClueIdsForPuzzle(puzzle: {
  _id: unknown;
  puzzleItems?: readonly ClueItem[] | null;
}): Promise<string[]> {
  const puzzleId = toIdString(puzzle._id);
  if (!puzzleId) return [];
  const slots = await packageSlots();
  if (!receivesStarterClues(puzzleId, slots)) return [];
  const ids = starterClueIds(puzzle.puzzleItems ?? []);
  warnIfStarterCluesMissing(puzzleId, ids);
  return ids;
}

export async function firstPackageHeadStart(language: Language): Promise<HeadStart | null> {
  if (!languageUsesStarterClues(language)) return null;
  const slots = await packageSlots();
  const puzzleId = firstPackagePuzzleId(language, slots);
  if (!puzzleId) return null;
  const puzzle = await Puzzle.findById(puzzleId)
    .select('puzzleItems.number puzzleItems.direction')
    .lean<{ puzzleItems?: ClueItem[] }>();
  if (!puzzle) return null;
  const items = puzzle.puzzleItems ?? [];
  const starterIds = starterClueIds(items);
  warnIfStarterCluesMissing(puzzleId, starterIds);
  return {
    puzzleId,
    starterIds,
    totalClues: items.length,
  };
}
