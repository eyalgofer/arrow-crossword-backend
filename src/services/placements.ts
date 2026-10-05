export interface Placement {
  userId: string;
  rank: number;
  claimedCount: number;
}

export interface PlacementPlayer {
  userId: unknown;
  claimedCount?: number;
  left?: boolean;
}

/**
 * Rank by claimed words. Players who left sit behind everyone still playing,
 * and equal counts share a rank (1, 1, 3).
 */
export function buildPlacements(players: PlacementPlayer[]): Placement[] {
  const ordered = [...players].sort((a, b) => {
    const leftDelta = Number(a.left === true) - Number(b.left === true);
    if (leftDelta !== 0) {
      return leftDelta;
    }
    return (b.claimedCount ?? 0) - (a.claimedCount ?? 0);
  });

  const placements: Placement[] = [];
  let index = 0;
  while (index < ordered.length) {
    const claimedCount = ordered[index].claimedCount ?? 0;
    const left = ordered[index].left === true;
    let end = index + 1;
    while (
      end < ordered.length
      && (ordered[end].left === true) === left
      && (ordered[end].claimedCount ?? 0) === claimedCount
    ) {
      end += 1;
    }

    const rank = index + 1;
    for (let cursor = index; cursor < end; cursor += 1) {
      placements.push({
        userId: idString(ordered[cursor].userId),
        rank,
        claimedCount
      });
    }
    index = end;
  }

  return placements;
}

/** The only player on rank 1, or null when that rank is shared. */
export function winnerIdFromPlacements(players: PlacementPlayer[]): string | null {
  const leaders = buildPlacements(players).filter(placement => placement.rank === 1);
  return leaders.length === 1 ? leaders[0].userId : null;
}

export function placementsForMatch(
  kind: string | null | undefined,
  players: PlacementPlayer[]
): Placement[] | undefined {
  if (kind !== 'group') {
    return undefined;
  }
  return buildPlacements(players);
}

/** A group match ends on leave only when one or zero players are still in it. */
export function groupLeaveEndsMatch(playersRemaining: number): boolean {
  return playersRemaining <= 1;
}

export type RosterState = 'playing' | 'left' | 'absent';

export function rosterState(
  players: Array<{ userId: { toString(): string }; left?: boolean }>,
  userId: string
): RosterState {
  const player = players.find(candidate => candidate.userId.toString() === userId);
  if (!player) {
    return 'absent';
  }
  return player.left === true ? 'left' : 'playing';
}

function idString(id: unknown): string {
  if (id == null) {
    return '';
  }
  if (typeof id === 'object' && id !== null && '_id' in id) {
    const inner = (id as { _id: unknown })._id;
    if (inner != null && inner !== id) {
      return idString(inner);
    }
  }
  return String(id);
}
