import { ILobby } from '../models/Lobby';
import { User } from '../models/User';

export interface LobbySeatView {
  userId: string;
  displayName: string;
  photoURL: string | null;
  status: string;
  isHost: boolean;
}

export interface LobbyView {
  _id: string;
  hostId: string;
  groupId: string | null;
  status: string;
  mode: string;
  timed: boolean;
  seats: LobbySeatView[];
}

/**
 * The app knows the signed-in player by firebase uid (`user.id`).
 * Lobby ids use that same value so the host is not mistaken for an invitee.
 */
export function mongoKey(id: unknown): string {
  if (id == null) {
    return '';
  }
  // A Mongoose ObjectId's `_id` is itself. Following it loops until the stack overflows.
  if (typeof id === 'object' && '_id' in id) {
    const inner = (id as { _id: unknown })._id;
    if (inner != null && inner !== id) {
      return mongoKey(inner);
    }
  }
  return String(id);
}

/** App `user.id` is the sign-in id. Group payloads use that so scores and results can find you. */
export function clientUserId(
  mongoId: unknown,
  firebaseUidById?: ReadonlyMap<string, string> | null
): string {
  const key = mongoKey(mongoId);
  return firebaseUidById?.get(key) || key;
}

export function serializeLobby(
  lobby: ILobby,
  firebaseUidById: ReadonlyMap<string, string> = new Map()
): LobbyView {
  const idOf = (id: unknown) => clientUserId(id, firebaseUidById);
  return {
    _id: lobby._id.toString(),
    hostId: idOf(lobby.hostId),
    groupId: lobby.groupId ? lobby.groupId.toString() : null,
    status: lobby.status,
    mode: lobby.mode,
    timed: lobby.timed,
    seats: lobby.seats.map(seat => ({
      userId: idOf(seat.userId),
      displayName: seat.displayName,
      photoURL: seat.photoURL ?? null,
      status: seat.status,
      isHost: seat.isHost === true
    }))
  };
}

const clientIdCache = new Map<string, Map<string, string>>();

export async function loadClientUserIds(ids: unknown[]): Promise<Map<string, string>> {
  const keys = ids.map(mongoKey).filter(id => id.length > 0);
  const users = await User.find({ _id: { $in: keys } }).select('firebaseUid');
  return new Map(users.map(user => [user._id.toString(), user.firebaseUid]));
}

export async function clientIdsForMatch(
  matchId: string,
  kind: string | null | undefined,
  playerIds: unknown[]
): Promise<ReadonlyMap<string, string> | null> {
  if (kind !== 'group') {
    return null;
  }
  const cached = clientIdCache.get(matchId);
  if (cached) {
    return cached;
  }
  const loaded = await loadClientUserIds(playerIds);
  clientIdCache.set(matchId, loaded);
  return loaded;
}

export async function serializeLobbyForClient(lobby: ILobby): Promise<LobbyView> {
  const ids = lobby.seats.map(seat => seat.userId);
  ids.push(lobby.hostId);
  return serializeLobby(lobby, await loadClientUserIds(ids));
}

export function lobbyRoom(lobbyId: string): string {
  return `lobby:${lobbyId}`;
}
