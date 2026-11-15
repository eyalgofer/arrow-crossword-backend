import { Puzzle } from '../models/Puzzle';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { HeadStart, puzzleProgressPercent } from './starterClues';
import { toIdString } from '../utils/objectId';

const RING_DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'challenging', 'expert']);

export interface PackageDocFields {
  _id?: unknown;
  name?: unknown;
  description?: unknown;
  theme?: unknown;
  language?: unknown;
  puzzleCount?: unknown;
  puzzleIds?: readonly unknown[] | null;
  order?: unknown;
  iconName?: unknown;
  gradientColors?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  __v?: unknown;
}

export interface PackageProgressRow {
  puzzleId: unknown;
  isCompleted?: boolean;
  completedClueIds?: readonly string[] | null;
  completedCluesCount?: number;
  totalClues?: number;
  lastPlayedAt?: Date;
}

export interface RingSummary {
  id: string;
  difficulty?: string;
}

function idString(id: unknown): string {
  return toIdString(id) ?? String(id);
}

function iso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

export function ringDifficulty(value: string | undefined): string | undefined {
  if (value && RING_DIFFICULTIES.has(value)) return value;
  return undefined;
}

/** Ring color only, in puzzleIds order. No grids, clues, or answers. */
export function puzzleRingSummaries(
  puzzleIds: readonly unknown[] | null | undefined,
  difficultyById: ReadonlyMap<string, string | undefined>
): RingSummary[] {
  const summaries: RingSummary[] = [];
  for (const raw of puzzleIds ?? []) {
    const id = idString(raw);
    const difficulty = ringDifficulty(difficultyById.get(id));
    summaries.push(difficulty ? { id, difficulty } : { id });
  }
  return summaries;
}

export function withRingDifficulties<T extends PackageDocFields>(
  packages: readonly T[],
  difficultyById: ReadonlyMap<string, string | undefined>
): Array<T & { puzzles: RingSummary[] }> {
  return packages.map(pkg => ({
    ...pkg,
    puzzles: puzzleRingSummaries(pkg.puzzleIds, difficultyById),
  }));
}

/**
 * One language catalog. he, en, and he-en stay distinct even when the
 * package list is empty. Difficulty is included so ring color is part of
 * the validator; puzzle grids are not.
 */
export function catalogEtagSource(
  language: string,
  packages: readonly PackageDocFields[],
  difficultyById: ReadonlyMap<string, string | undefined>
): unknown {
  return {
    language,
    packages: packages.map(pkg => ({
      ...packageDocSource(pkg),
      puzzles: puzzleRingSummaries(pkg.puzzleIds, difficultyById),
    })),
  };
}

function packageDocSource(pkg: PackageDocFields): Record<string, unknown> {
  return {
    _id: pkg._id == null ? null : idString(pkg._id),
    name: pkg.name ?? null,
    description: pkg.description ?? null,
    theme: pkg.theme ?? null,
    language: pkg.language ?? null,
    puzzleCount: pkg.puzzleCount ?? null,
    puzzleIds: (pkg.puzzleIds ?? []).map(id => idString(id)),
    order: pkg.order ?? null,
    iconName: pkg.iconName ?? null,
    gradientColors: Array.isArray(pkg.gradientColors) ? [...pkg.gradientColors] : null,
    createdAt: iso(pkg.createdAt),
    updatedAt: iso(pkg.updatedAt),
    __v: pkg.__v ?? null,
  };
}

/** Difficulty only. Never the grid, clues, or answers. */
export async function loadRingDifficulties(
  puzzleIds: readonly unknown[]
): Promise<Map<string, string>> {
  const ids = [...new Set(puzzleIds.map(id => idString(id)))];
  if (ids.length === 0) return new Map();
  const rows = await Puzzle.find({ _id: { $in: ids } }).select('_id difficulty').lean();
  const difficultyById = new Map<string, string>();
  for (const row of rows) {
    const id = idString(row._id);
    if (typeof row.difficulty === 'string') difficultyById.set(id, row.difficulty);
  }
  return difficultyById;
}

/**
 * Clue ids change the percent only for the unfinished opening puzzle.
 * Other rows are counted from completedCluesCount, so their id lists stay unread.
 */
export async function attachOpenerClueIds(
  userId: unknown,
  headStart: HeadStart | null,
  progressDocs: PackageProgressRow[],
): Promise<void> {
  if (!headStart) return;
  const opener = progressDocs.find(
    doc => idString(doc.puzzleId) === headStart.puzzleId && doc.isCompleted !== true,
  );
  if (!opener || opener.completedClueIds != null) return;
  const saved = await UserPuzzleProgress.findOne({
    userId,
    puzzleId: headStart.puzzleId,
  })
    .select('completedClueIds')
    .lean();
  opener.completedClueIds = saved?.completedClueIds ?? [];
}

export function buildPackageProgress(input: {
  packages: readonly PackageDocFields[];
  headStart: HeadStart | null;
  progressDocs: readonly PackageProgressRow[];
}): {
  progress: Array<{
    packageId: unknown;
    completedCount: number;
    isCompleted: boolean;
    lastPlayedAt?: Date;
    puzzles: Array<{ puzzleId: string; progress: number; lastPlayedAt?: Date }>;
  }>;
  totalCompletedPuzzles: number;
} {
  const headStart = input.headStart;
  const progressByPuzzleId = new Map(
    input.progressDocs.map(row => [idString(row.puzzleId), row])
  );

  const progress = input.packages.map(pkg => {
    let lastPlayedAt: Date | undefined;
    const puzzleIds = pkg.puzzleIds ?? [];

    const puzzles = puzzleIds.map(puzzleId => {
      const puzzleKey = idString(puzzleId);
      const saved = progressByPuzzleId.get(puzzleKey);
      const isHeadStart = headStart != null
        && headStart.puzzleId === puzzleKey
        && !saved?.isCompleted;
      const percent = puzzleProgressPercent({
        isCompleted: saved?.isCompleted,
        completedClueIds: isHeadStart ? saved?.completedClueIds ?? undefined : undefined,
        completedCluesCount: saved?.completedCluesCount,
        totalClues: saved?.totalClues || (isHeadStart ? headStart.totalClues : 0),
        starterIds: isHeadStart ? headStart.starterIds : undefined,
      });
      const entry: { puzzleId: string; progress: number; lastPlayedAt?: Date } = {
        puzzleId: puzzleKey,
        progress: percent,
      };

      if (saved?.lastPlayedAt) {
        entry.lastPlayedAt = saved.lastPlayedAt;
        if (!lastPlayedAt || saved.lastPlayedAt > lastPlayedAt) {
          lastPlayedAt = saved.lastPlayedAt;
        }
      }

      return entry;
    });

    const completedCount = puzzles.filter(puzzle => puzzle.progress === 100).length;

    return {
      packageId: pkg._id,
      completedCount,
      isCompleted: puzzleIds.length > 0 && completedCount === puzzleIds.length,
      ...(lastPlayedAt ? { lastPlayedAt } : {}),
      puzzles,
    };
  });

  const totalCompletedPuzzles = progress.reduce((sum, row) => sum + row.completedCount, 0);
  return { progress, totalCompletedPuzzles };
}

/**
 * Hash of this user's package progress for one language. userId is part of
 * the validator so two players with the same rings do not share an etag.
 * Fields that are not in the progress JSON (hints, times, grids) are omitted.
 */
export function progressEtagSource(input: {
  userId: string;
  language: string;
  packages: readonly PackageDocFields[];
  headStart: HeadStart | null;
  progressDocs: readonly PackageProgressRow[];
}): unknown {
  return {
    userId: input.userId,
    language: input.language,
    packages: input.packages.map(pkg => ({
      packageId: pkg._id == null ? null : idString(pkg._id),
      puzzleIds: (pkg.puzzleIds ?? []).map(id => idString(id)),
    })),
    headStart: input.headStart
      ? {
          puzzleId: input.headStart.puzzleId,
          starterIds: [...input.headStart.starterIds],
          totalClues: input.headStart.totalClues,
        }
      : null,
    saved: input.progressDocs
      .map(doc => {
        const puzzleId = idString(doc.puzzleId);
        const opener = input.headStart != null
          && input.headStart.puzzleId === puzzleId
          && doc.isCompleted !== true;
        return {
          puzzleId,
          isCompleted: doc.isCompleted === true,
          ...(opener
            ? { completedClueIds: [...(doc.completedClueIds ?? [])].sort() }
            : {}),
          completedCluesCount: doc.completedCluesCount ?? 0,
          totalClues: doc.totalClues ?? 0,
          lastPlayedAt: iso(doc.lastPlayedAt),
        };
      })
      .sort((a, b) => a.puzzleId.localeCompare(b.puzzleId)),
  };
}
