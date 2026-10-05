import { MatchStatus } from '../types';
import { resolvePlayerId } from '../utils/ghost';
import { clientUserId, loadClientUserIds } from './lobbyView';
import { Placement, PlacementPlayer, placementsForMatch } from './placements';

export interface PublicMatchPlayer {
  userId: string;
  displayName: string;
  photoURL: string | null;
  progress: number;
  claimedCount: number;
  left: boolean;
}

export interface MatchReadPlayer extends PlacementPlayer {
  displayName?: string;
  photoURL?: string | null;
  progress?: number;
  completedAt?: Date;
}

export interface MatchReadSource {
  kind?: string | null;
  groupId?: unknown;
  status?: string;
  opponentKind?: string | null;
  players: MatchReadPlayer[];
}

export interface GroupReadFields {
  kind: 'duel' | 'group';
  groupId?: string | null;
  players?: PublicMatchPlayer[];
  opponent?: unknown;
  placements?: Placement[];
}

export function resolveMatchKind(match: { kind?: string | null }): 'duel' | 'group' {
  return match.kind === 'group' ? 'group' : 'duel';
}

export function serializeMatchPlayers(match: MatchReadSource): PublicMatchPlayer[] {
  return match.players.map(player => {
    const populated = populatedUser(player.userId);
    const photoURL = player.photoURL || populated?.photoURL || null;
    return {
      userId: resolvePlayerId(player.userId, match.opponentKind),
      displayName: player.displayName || populated?.displayName || '',
      photoURL,
      progress: player.progress ?? 0,
      claimedCount: player.claimedCount ?? 0,
      left: player.left === true
    };
  });
}

export function groupSessionFields(match: { kind?: string | null; groupId?: unknown }): {
  kind: 'duel' | 'group';
  groupId?: string | null;
} {
  const kind = resolveMatchKind(match);
  if (kind !== 'group') {
    return { kind };
  }
  return {
    kind,
    groupId: match.groupId ? String(match.groupId) : null
  };
}

export function applyMatchReadFields<T extends object>(
  payload: T,
  match: MatchReadSource,
  viewerId: string,
  clientIds?: ReadonlyMap<string, string> | null
): T & GroupReadFields {
  const kind = resolveMatchKind(match);
  const next: T & GroupReadFields = { ...payload, kind };
  if (kind !== 'group') {
    return next;
  }

  const idOf = (id: unknown) => clientUserId(id, clientIds);
  const players = serializeMatchPlayers(match).map(player => ({
    ...player,
    userId: idOf(player.userId)
  }));
  next.groupId = match.groupId ? String(match.groupId) : null;
  next.players = players;

  if (match.players.length === 2) {
    const viewer = idOf(viewerId);
    const other = players.find(player => player.userId !== viewer);
    if (other) {
      next.opponent = {
        userId: other.userId,
        _id: other.userId,
        displayName: other.displayName,
        name: other.displayName,
        photoURL: other.photoURL,
        progress: other.progress,
        claimedCount: other.claimedCount,
        left: other.left
      };
    }
  } else {
    delete next.opponent;
    delete (next as { opponentProgress?: unknown }).opponentProgress;
  }

  const placements = match.status === MatchStatus.COMPLETED
    ? placementsForMatch('group', match.players)
    : undefined;
  if (placements) {
    next.placements = placements.map(placement => ({
      ...placement,
      userId: idOf(placement.userId)
    }));
  }

  const withWinner = next as T & GroupReadFields & { winnerId?: unknown; claimedWords?: { userId?: unknown }[] };
  if (withWinner.winnerId) {
    withWinner.winnerId = idOf(withWinner.winnerId);
  }
  if (Array.isArray(withWinner.claimedWords)) {
    withWinner.claimedWords = withWinner.claimedWords.map(word => ({
      ...word,
      userId: idOf(word.userId)
    }));
  }

  return next;
}

export async function applyMatchReadFieldsForClient<T extends object>(
  payload: T,
  match: MatchReadSource,
  viewerId: string
): Promise<T & GroupReadFields> {
  const clientIds = resolveMatchKind(match) === 'group'
    ? await loadClientUserIds(match.players.map(player => player.userId))
    : null;
  return applyMatchReadFields(payload, match, viewerId, clientIds);
}

function populatedUser(userId: unknown): { displayName?: string; photoURL?: string } | null {
  if (!userId || typeof userId !== 'object' || !('_id' in userId)) {
    return null;
  }
  return userId as { displayName?: string; photoURL?: string };
}
