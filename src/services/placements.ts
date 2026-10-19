export interface Placement {
  userId: string;
  rank: number;
  claimedCount: number;
}

export interface PlacementPlayer {
  userId: unknown;
  claimedCount?: number;
  progress?: number;
  left?: boolean;
}

/** Quick play ranks claimed words. A normal game ranks how much of the board was filled. */
export type PlacementMode = 'quick' | 'normal';

export function placementMode(mode: string | null | undefined): PlacementMode {
  return mode === 'quick' ? 'quick' : 'normal';
}

/**
 * Rank the score this mode played. Players who left sit behind everyone still
 * playing, and equal scores share a rank (1, 1, 3).
 * A quick game with no claims falls back to progress, matching a board whose
 * claims never landed.
 */
export function buildPlacements(
  players: PlacementPlayer[],
  mode: PlacementMode = 'quick',
): Placement[] {
  const anyClaims = players.some(player => (player.claimedCount ?? 0) > 0);
  const scoreOf = (player: PlacementPlayer) => placementScore(player, mode, anyClaims);
  const ordered = [...players].sort((a, b) => {
    const leftDelta = Number(a.left === true) - Number(b.left === true);
    if (leftDelta !== 0) {
      return leftDelta;
    }
    return scoreOf(b) - scoreOf(a);
  });

  const placements: Placement[] = [];
  let index = 0;
  while (index < ordered.length) {
    const score = scoreOf(ordered[index]);
    const left = ordered[index].left === true;
    let end = index + 1;
    while (
      end < ordered.length
      && (ordered[end].left === true) === left
      && scoreOf(ordered[end]) === score
    ) {
      end += 1;
    }

    const rank = index + 1;
    for (let cursor = index; cursor < end; cursor += 1) {
      placements.push({
        userId: idString(ordered[cursor].userId),
        rank,
        claimedCount: ordered[cursor].claimedCount ?? 0,
      });
    }
    index = end;
  }

  return placements;
}

/** The only player on rank 1, or null when that rank is shared. */
export function winnerIdFromPlacements(
  players: PlacementPlayer[],
  mode: PlacementMode = 'quick',
): string | null {
  const leaders = buildPlacements(players, mode).filter(placement => placement.rank === 1);
  return leaders.length === 1 ? leaders[0].userId : null;
}

export function placementsForMatch(
  kind: string | null | undefined,
  players: PlacementPlayer[],
  mode: PlacementMode = 'quick',
): Placement[] | undefined {
  if (kind !== 'group') {
    return undefined;
  }
  return buildPlacements(players, mode);
}

function placementScore(player: PlacementPlayer, mode: PlacementMode, anyClaims: boolean): number {
  if (mode === 'quick' && anyClaims) {
    return player.claimedCount ?? 0;
  }
  return player.progress ?? 0;
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
