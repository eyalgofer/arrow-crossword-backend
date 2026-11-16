import { PlayTabStamp } from '../models/PlayTabStamp';
import { ifNoneMatchMatches } from '../utils/conditionalGet';

const EPOCHS_ID = 'epochs';

export function progressDocId(userId: string): string {
  return `progress:${userId}`;
}

export function dailyCardKey(language: string, year: number, dayOfYear: number): string {
  return `${language}:${year}:${dayOfYear}`;
}

/**
 * Stored etag is reusable only when it matches the request and, for progress,
 * the catalog generation it was built from.
 */
export function reusableEtag(
  stamp: { etag?: string | null; generation?: number | null } | null | undefined,
  header: string | string[] | undefined,
  generation?: number
): string | null {
  if (!stamp?.etag) return null;
  if (generation != null && stamp.generation !== generation) return null;
  if (!ifNoneMatchMatches(header, stamp.etag)) return null;
  return stamp.etag;
}

export interface StampBinding {
  etag?: string | null;
  catalog?: number | null;
  progress?: number | null;
  daily?: number | null;
  picks?: number | null;
  community?: number | null;
}

/**
 * A stamp is reusable only when every epoch it was built from is still current.
 * Callers pass the epochs observed before the payload query, and the write
 * stores those same numbers. A later save bumps an epoch, so this returns null
 * instead of replaying the pre-save body.
 */
export function matchingStamp(
  stored: StampBinding | null | undefined,
  header: string | string[] | undefined,
  live: StampBinding
): string | null {
  if (!stored?.etag) return null;
  if (live.catalog != null && stored.catalog !== live.catalog) return null;
  if (live.progress != null && stored.progress !== live.progress) return null;
  if (live.daily != null && stored.daily !== live.daily) return null;
  if (live.picks != null && stored.picks !== live.picks) return null;
  if (live.community != null && stored.community !== live.community) return null;
  if (!ifNoneMatchMatches(header, stored.etag)) return null;
  return stored.etag;
}

const DAILY_ASSIGNMENT_FIELDS = ['puzzleId', 'dayOfYear', 'year', 'language', 'date'];

/** True when a DailyPuzzle write can change which crossword is today's daily. */
export function updatesDailyAssignment(update: unknown): boolean {
  if (!update || typeof update !== 'object' || Array.isArray(update)) return true;
  const record = update as Record<string, unknown>;
  const fields = new Set<string>();
  const set = record.$set;
  if (set && typeof set === 'object' && !Array.isArray(set)) {
    for (const key of Object.keys(set as Record<string, unknown>)) fields.add(key);
  }
  for (const key of Object.keys(record)) {
    if (!key.startsWith('$')) fields.add(key);
  }
  if (fields.size === 0) return true;
  return DAILY_ASSIGNMENT_FIELDS.some((field) => fields.has(field));
}

export interface PlayEpochs {
  catalog: number;
  daily: number;
  community: number;
  picks: number;
  catalogEtags: Record<string, string>;
  solvedEtags: Record<string, string>;
}

export interface ViewerStamp {
  generation: number;
  catalogGeneration: number | null;
  etags: Record<string, string>;
  cards: {
    daily?: Record<string, StampBinding>;
    favorites?: Record<string, StampBinding>;
    categories?: Record<string, StampBinding>;
  };
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, string>;
}

function asCards(value: unknown): ViewerStamp['cards'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as ViewerStamp['cards'];
}

export async function readEpochs(): Promise<PlayEpochs> {
  const doc = await PlayTabStamp.findById(EPOCHS_ID).lean();
  return {
    catalog: asNumber(doc?.catalog),
    daily: asNumber(doc?.daily),
    community: asNumber(doc?.community),
    picks: asNumber(doc?.picks),
    catalogEtags: asMap(doc?.catalogEtags),
    solvedEtags: asMap(doc?.solvedEtags),
  };
}

export async function readViewerStamp(userId: string): Promise<ViewerStamp> {
  const doc = await PlayTabStamp.findById(progressDocId(userId)).lean();
  return {
    generation: asNumber(doc?.generation),
    catalogGeneration: typeof doc?.catalogGeneration === 'number' ? doc.catalogGeneration : null,
    etags: asMap(doc?.etags),
    cards: asCards(doc?.cards),
  };
}

function duplicateKey(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: number }).code === 11000;
}

/** Epoch 0 also matches a doc created by a different bump that left this field unset. */
function epochClause(field: string, seen: number): Record<string, unknown> {
  if (seen === 0) {
    return { $or: [{ [field]: 0 }, { [field]: { $exists: false } }] };
  }
  return { [field]: seen };
}

function epochsFilter(id: string, epochs: Record<string, number>): Record<string, unknown> {
  return {
    _id: id,
    $and: Object.entries(epochs).map(([field, seen]) => epochClause(field, seen)),
  };
}

/**
 * Write only while the epoch filter still matches. A save that bumped the
 * epoch makes this a no-op, so an in-flight response cannot restore a stale etag.
 * The first write creates the doc when every guarded epoch is still 0.
 */
async function writeIfMatch(
  filter: Record<string, unknown>,
  set: Record<string, unknown>,
  createDoc: Record<string, unknown> | null
): Promise<void> {
  const updated = await PlayTabStamp.updateOne(filter, { $set: set });
  if (updated.matchedCount > 0 || !createDoc) return;
  try {
    await PlayTabStamp.create(createDoc);
  } catch (error) {
    if (!duplicateKey(error)) throw error;
    await PlayTabStamp.updateOne(filter, { $set: set });
  }
}

export async function rememberCatalogEtag(
  language: string,
  seenCatalog: number,
  etag: string
): Promise<void> {
  await writeIfMatch(
    epochsFilter(EPOCHS_ID, { catalog: seenCatalog }),
    { [`catalogEtags.${language}`]: etag },
    seenCatalog === 0
      ? {
          _id: EPOCHS_ID,
          catalog: 0,
          daily: 0,
          community: 0,
          picks: 0,
          catalogEtags: { [language]: etag },
        }
      : null
  );
}

export async function rememberProgressEtag(
  userId: string,
  language: string,
  seenProgress: number,
  seenCatalog: number,
  etag: string
): Promise<void> {
  const id = progressDocId(userId);
  await writeIfMatch(
    epochsFilter(id, { generation: seenProgress }),
    { [`etags.${language}`]: etag, catalogGeneration: seenCatalog },
    seenProgress === 0
      ? {
          _id: id,
          generation: 0,
          catalogGeneration: seenCatalog,
          etags: { [language]: etag },
        }
      : null
  );
}

export async function rememberSolvedEtag(
  key: string,
  seenCommunity: number,
  seenDaily: number,
  etag: string
): Promise<void> {
  await writeIfMatch(
    epochsFilter(EPOCHS_ID, { community: seenCommunity, daily: seenDaily }),
    { [`solvedEtags.${key}`]: etag },
    seenCommunity === 0 && seenDaily === 0
      ? {
          _id: EPOCHS_ID,
          catalog: 0,
          daily: 0,
          community: 0,
          picks: 0,
          solvedEtags: { [key]: etag },
        }
      : null
  );
}

export async function rememberViewerCard(
  userId: string,
  bucket: 'daily' | 'favorites' | 'categories',
  key: string,
  seenProgress: number,
  value: StampBinding
): Promise<void> {
  const id = progressDocId(userId);
  await writeIfMatch(
    epochsFilter(id, { generation: seenProgress }),
    { [`cards.${bucket}.${key}`]: value },
    seenProgress === 0
      ? {
          _id: id,
          generation: 0,
          cards: { [bucket]: { [key]: value } },
        }
      : null
  );
}

function bump(field: 'catalog' | 'daily' | 'community' | 'picks', unset?: string): void {
  const setOnInsert: Record<string, number> = {};
  for (const key of ['catalog', 'daily', 'community', 'picks']) {
    if (key !== field) setOnInsert[key] = 0;
  }
  void PlayTabStamp.updateOne(
    { _id: EPOCHS_ID },
    {
      $inc: { [field]: 1 },
      ...(unset ? { $unset: { [unset]: 1 } } : {}),
      $setOnInsert: setOnInsert,
    },
    { upsert: true }
  ).catch((error) => {
    console.error('Failed to drop play-tab stamp:', error);
  });
}

/** Package or puzzle content changed. The next catalog and card reads rebuild. */
export function invalidateCatalog(): void {
  bump('catalog', 'catalogEtags');
}

/** Today's assigned crossword changed. */
export function invalidateDailyAssignment(): void {
  bump('daily', 'solvedEtags');
}

/** A public solved count or fastest time changed. */
export function invalidateCommunity(): void {
  bump('community', 'solvedEtags');
}

/** Editors' picks or category boards changed. */
export function invalidatePicks(): void {
  bump('picks');
}

/** This player's package rings and play-tab cards changed. */
export function invalidateUserProgress(userId: unknown): void {
  const id = userId == null ? '' : String(userId);
  if (!id) return;
  void PlayTabStamp.updateOne(
    { _id: progressDocId(id) },
    { $inc: { generation: 1 }, $unset: { etags: 1, cards: 1 } },
    { upsert: true }
  ).catch((error) => {
    console.error('Failed to drop play-tab progress stamp:', error);
  });
}
