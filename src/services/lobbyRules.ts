/** A waiting lobby that nobody starts is dropped after this long. */
export const LOBBY_WAITING_MS = 15 * 60 * 1000;

export function lobbyExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + LOBBY_WAITING_MS);
}

export function isLobbyExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function seatStatusForAction(action: unknown): 'joined' | 'declined' | null {
  if (action === 'accept') {
    return 'joined';
  }
  if (action === 'decline') {
    return 'declined';
  }
  return null;
}

export interface StartSeat {
  isHost: boolean;
  status: string;
}

export function canStartLobby(lobby: {
  status: string;
  seats: StartSeat[];
}): { ok: true } | { ok: false; error: string } {
  if (lobby.status !== 'waiting') {
    return { ok: false, error: 'Lobby is not waiting' };
  }

  const joinedInvitees = lobby.seats.filter(seat => !seat.isHost && seat.status === 'joined');
  if (joinedInvitees.length < 1) {
    return { ok: false, error: 'At least one player must join before starting' };
  }

  const joined = lobby.seats.filter(seat => seat.status === 'joined');
  if (joined.length < 2 || joined.length > 4) {
    return { ok: false, error: 'A group match needs 2 to 4 players' };
  }

  return { ok: true };
}
