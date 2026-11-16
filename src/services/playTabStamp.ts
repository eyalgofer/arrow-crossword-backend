import { PlayTabStamp } from '../models/PlayTabStamp';
import { ifNoneMatchMatches } from '../utils/conditionalGet';

const LANGUAGES = ['en', 'he', 'he-en'] as const;

export function catalogStampId(language: string): string {
  return `catalog:${language}`;
}

export function progressStampId(userId: string, language: string): string {
  return `progress:${userId}:${language}`;
}

const CATALOG_GENERATION_ID = 'catalogGeneration';

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

export async function catalogStampHit(
  language: string,
  header: string | string[] | undefined
): Promise<string | null> {
  const stamp = await PlayTabStamp.findById(catalogStampId(language)).select('etag').lean();
  return reusableEtag(stamp, header);
}

export async function rememberCatalogStamp(language: string, etag: string): Promise<void> {
  await PlayTabStamp.updateOne(
    { _id: catalogStampId(language) },
    { $set: { etag } },
    { upsert: true }
  );
}

export async function readCatalogGeneration(): Promise<number> {
  const stamp = await PlayTabStamp.findById(CATALOG_GENERATION_ID).select('generation').lean();
  return stamp?.generation ?? 0;
}

export async function progressStampHit(
  userId: string,
  language: string,
  header: string | string[] | undefined
): Promise<string | null> {
  const generation = await readCatalogGeneration();
  const stamp = await PlayTabStamp.findById(progressStampId(userId, language))
    .select('etag generation')
    .lean();
  return reusableEtag(stamp, header, generation);
}

export async function rememberProgressStamp(
  userId: string,
  language: string,
  etag: string
): Promise<void> {
  const generation = await readCatalogGeneration();
  await PlayTabStamp.updateOne(
    { _id: progressStampId(userId, language) },
    { $set: { etag, generation } },
    { upsert: true }
  );
}

/** Package or puzzle content changed. The next catalog and progress reads rebuild. */
export function invalidateCatalog(): void {
  void clearCatalog().catch((error) => {
    console.error('Failed to drop play-tab catalog stamp:', error);
  });
}

async function clearCatalog(): Promise<void> {
  await PlayTabStamp.deleteMany({
    _id: { $in: LANGUAGES.map(catalogStampId) },
  });
  await PlayTabStamp.updateOne(
    { _id: CATALOG_GENERATION_ID },
    { $inc: { generation: 1 } },
    { upsert: true }
  );
}

/** This player's package rings changed. */
export function invalidateUserProgress(userId: unknown): void {
  const id = userId == null ? '' : String(userId);
  if (!id) return;
  void PlayTabStamp.deleteMany({
    _id: { $in: LANGUAGES.map((language) => progressStampId(id, language)) },
  }).catch((error) => {
    console.error('Failed to drop play-tab progress stamp:', error);
  });
}
