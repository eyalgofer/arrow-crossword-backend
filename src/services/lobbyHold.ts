/** How long a boost-ad hold may block lobby start. A killed app cannot hold longer. */
export const LOBBY_HOLD_MS = 90_000;

export interface HoldSeat {
  userId: { toString(): string };
  status: string;
  holdStartedAt?: Date | string | null;
}

/** A joined seat is holding when the ad flag is set and younger than 90 seconds. */
export function seatHoldActive(seat: HoldSeat, now = Date.now()): boolean {
  if (seat.status !== 'joined' || seat.holdStartedAt == null) {
    return false;
  }
  const started = new Date(seat.holdStartedAt).getTime();
  return Number.isFinite(started) && now - started < LOBBY_HOLD_MS;
}

export function firstActiveHold(seats: HoldSeat[], now = Date.now()): HoldSeat | undefined {
  return seats.find(seat => seatHoldActive(seat, now));
}
