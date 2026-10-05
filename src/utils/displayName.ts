import { User } from '../models/User';
import { containsBlockedDisplayName } from './displayNameProfanity';

export const DISPLAY_NAME_MIN = 3;
export const DISPLAY_NAME_MAX = 16;

/** Trimmed nickname used for storage and uniqueness. */
export function normalizeDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Lowercase key for the sparse unique index. */
export function displayNameKey(normalized: string): string {
  return normalized.toLocaleLowerCase();
}

export function validateDisplayName(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'displayName is required' };
  }
  const value = normalizeDisplayName(raw);
  const length = Array.from(value).length;
  if (length < DISPLAY_NAME_MIN || length > DISPLAY_NAME_MAX) {
    return {
      ok: false,
      error: `displayName must be ${DISPLAY_NAME_MIN}–${DISPLAY_NAME_MAX} characters`,
    };
  }
  if (containsBlockedDisplayName(value)) {
    return { ok: false, error: 'Display name is not allowed' };
  }
  return { ok: true, value };
}

/** Whole nickname only. A prefix must not return other people. */
export function exactNicknameFilter(raw: string): { $or: Array<Record<string, unknown>> } {
  const value = normalizeDisplayName(raw);
  return {
    $or: [
      { displayNameKey: displayNameKey(value) },
      { displayName: new RegExp(`^${escapeRegex(value)}$`, 'i') },
    ],
  };
}

export async function isDisplayNameTaken(name: string, excludeUserId?: unknown): Promise<boolean> {
  const value = normalizeDisplayName(name);
  if (!value) return false;
  const key = displayNameKey(value);
  const filter: Record<string, unknown> = {
    $or: [
      { displayNameKey: key },
      { displayName: new RegExp(`^${escapeRegex(value)}$`, 'i') },
    ],
  };
  if (excludeUserId) {
    filter._id = { $ne: excludeUserId };
  }
  const existing = await User.findOne(filter).select('_id').lean();
  return !!existing;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
