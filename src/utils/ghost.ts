import mongoose from 'mongoose';
import { GHOST_OPPONENT_ID } from '../constants/match';

export function ghostOpponentObjectId(): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(GHOST_OPPONENT_ID);
}

function isObjectId(id: object): boolean {
  return id instanceof mongoose.Types.ObjectId
    || (id as { _bsontype?: string })._bsontype === 'ObjectId';
}

/** Id of a match player after populate. A missing ghost user keeps the reserved id. */
export function resolvePlayerId(userId: unknown, opponentKind?: string | null): string {
  if (userId == null) {
    return isGhostKind(opponentKind) ? GHOST_OPPONENT_ID : '';
  }
  if (typeof userId === 'object') {
    if (isObjectId(userId)) {
      return String(userId);
    }
    if ('_id' in userId && (userId as { _id?: unknown })._id != null) {
      return resolvePlayerId((userId as { _id: unknown })._id, opponentKind);
    }
  }
  return String(userId);
}

export function isGhostOpponentId(id: unknown): boolean {
  if (id == null) {
    return false;
  }
  if (typeof id === 'object') {
    // ObjectId exposes `_id` as another ObjectId. Following that loops forever.
    if (isObjectId(id)) {
      return String(id) === GHOST_OPPONENT_ID;
    }
    if ('_id' in id) {
      const inner = (id as { _id?: unknown })._id;
      if (inner != null && inner !== id) {
        return isGhostOpponentId(inner);
      }
    }
  }
  return String(id) === GHOST_OPPONENT_ID;
}

export function isGhostKind(kind?: string | null): kind is 'replay' | 'solver' {
  return kind === 'replay' || kind === 'solver';
}

/** Same themed prefixes the signup screen uses when it suggests a nickname. */
const HEBREW_NICK_PREFIXES = [
  'תשחצן',
  'רמזן',
  'פותר',
  'שועל',
  'משבצת',
  'נשר',
  'אריה',
  'ברק',
  'כוכב',
  'גאון',
  'צייד',
] as const;

const ENGLISH_NICK_PREFIXES = [
  'solver',
  'cluefox',
  'gridfox',
  'puzzler',
  'wordfox',
  'lynx',
  'otter',
  'hawk',
  'glyph',
  'rune',
  'cub',
] as const;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Signup-style nickname: prefix plus 3–4 digits. */
export function generateThemedNickname(language: 'en' | 'he'): string {
  const prefixes = language === 'he' ? HEBREW_NICK_PREFIXES : ENGLISH_NICK_PREFIXES;
  const prefix = prefixes[randomInt(0, prefixes.length - 1)];
  const digits = randomInt(3, 4);
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return `${prefix}${randomInt(min, max)}`;
}
