import mongoose from 'mongoose';
import { GHOST_OPPONENT_ID } from '../constants/match';

export function ghostOpponentObjectId(): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(GHOST_OPPONENT_ID);
}

/** Id of a match player after populate. A missing ghost user keeps the reserved id. */
export function resolvePlayerId(userId: unknown, opponentKind?: string | null): string {
  if (userId == null) {
    return isGhostKind(opponentKind) ? GHOST_OPPONENT_ID : '';
  }
  if (typeof userId === 'object' && userId !== null && '_id' in userId && (userId as { _id?: unknown })._id != null) {
    return String((userId as { _id: unknown })._id);
  }
  return String(userId);
}

export function isGhostOpponentId(id: unknown): boolean {
  if (id == null) {
    return false;
  }
  if (typeof id === 'object' && id !== null && '_id' in id) {
    return isGhostOpponentId((id as { _id: unknown })._id);
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

/** Signup-style nickname: prefix plus an underscore and 3–4 digits. */
export function generateThemedNickname(language: 'en' | 'he'): string {
  const prefixes = language === 'he' ? HEBREW_NICK_PREFIXES : ENGLISH_NICK_PREFIXES;
  const prefix = prefixes[randomInt(0, prefixes.length - 1)];
  const digits = randomInt(3, 4);
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return `${prefix}_${randomInt(min, max)}`;
}
