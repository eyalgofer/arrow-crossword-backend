import { ILobby } from '../models/Lobby';

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

export function serializeLobby(lobby: ILobby): LobbyView {
  return {
    _id: lobby._id.toString(),
    hostId: lobby.hostId.toString(),
    groupId: lobby.groupId ? lobby.groupId.toString() : null,
    status: lobby.status,
    mode: lobby.mode,
    timed: lobby.timed,
    seats: lobby.seats.map(seat => ({
      userId: seat.userId.toString(),
      displayName: seat.displayName,
      photoURL: seat.photoURL ?? null,
      status: seat.status,
      isHost: seat.isHost
    }))
  };
}

export function lobbyRoom(lobbyId: string): string {
  return `lobby:${lobbyId}`;
}
