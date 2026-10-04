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

export function solverDisplayName(language: 'en' | 'he'): string {
  return language === 'he' ? 'יריב' : 'Opponent';
}
