import { GhostEvent } from '../types';

export interface ReplaySource {
  startedAt: Date;
  /** When that match ended (timeout or completion), not when this player finished. */
  endedAt: Date;
  playerCompletedAt?: Date | null;
  finalProgress: number;
  moves: Array<{ row: number; col: number; letter: string; timestamp: Date }>;
}

const PROGRESS_SAMPLE_MS = 5_000;
const SOLVER_STEP_MS = 4_000;
/** Solver pace as a fraction of the match length. Below 1 finishes in time. */
const SOLVER_PACE_MIN = 0.72;
const SOLVER_PACE_STEPS = 46;

function typeRank(type: GhostEvent['type']): number {
  if (type === 'move') return 0;
  if (type === 'progress') return 1;
  return 2;
}

function mix(seed: number): number {
  let x = Math.imul(seed | 0, 0x9e3779b1);
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  return x >>> 0;
}

export function solverPaceFromSeed(seed: number): number {
  return SOLVER_PACE_MIN + (mix(seed) % SOLVER_PACE_STEPS) / 100;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Replay a past player's moves and progress on the same clock as the original game.
 * Progress is scaled to the new match length when they were slower than this match.
 */
export function buildReplaySchedule(source: ReplaySource, matchDurationMs: number): GhostEvent[] {
  const origin = source.startedAt.getTime();
  const offset = (date: Date) => date.getTime() - origin;
  const finished = source.playerCompletedAt != null || source.finalProgress >= 100;
  const naturalEndMs = Math.max(
    0,
    finished && source.playerCompletedAt
      ? offset(source.playerCompletedAt)
      : offset(source.endedAt)
  );
  const target = finished ? 100 : clampProgress(source.finalProgress);
  const events: GhostEvent[] = [];

  const moves = source.moves
    .map(move => ({ ...move, atMs: offset(move.timestamp) }))
    .filter(move => move.atMs >= 0 && move.atMs <= matchDurationMs)
    .sort((a, b) => a.atMs - b.atMs);

  for (const move of moves) {
    events.push({
      atMs: move.atMs,
      type: 'move',
      row: move.row,
      col: move.col,
      letter: move.letter
    });
  }

  const sampleEnd = Math.min(matchDurationMs, naturalEndMs > 0 ? naturalEndMs : matchDurationMs);
  const denom = naturalEndMs > 0 ? naturalEndMs : sampleEnd;
  const sampleTimes = new Set<number>();
  if (sampleEnd > 0 && denom > 0 && target > 0) {
    for (let t = PROGRESS_SAMPLE_MS; t < sampleEnd; t += PROGRESS_SAMPLE_MS) {
      sampleTimes.add(t);
    }
    for (const move of moves) {
      if (move.atMs > 0 && move.atMs <= sampleEnd) {
        sampleTimes.add(move.atMs);
      }
    }
    sampleTimes.add(sampleEnd);
  }

  let lastProgress = 0;
  for (const atMs of [...sampleTimes].sort((a, b) => a - b)) {
    const progress = Math.min(target, Math.round(target * atMs / denom));
    if (progress > lastProgress) {
      events.push({ atMs, type: 'progress', progress });
      lastProgress = progress;
    }
  }

  if (finished && naturalEndMs > 0 && naturalEndMs <= matchDurationMs) {
    if (lastProgress < 100) {
      events.push({ atMs: naturalEndMs, type: 'progress', progress: 100 });
    }
    events.push({ atMs: naturalEndMs, type: 'finish' });
  }

  events.sort((a, b) => a.atMs - b.atMs || typeRank(a.type) - typeRank(b.type));
  return events;
}

/**
 * A paced stand-in used only when this puzzle has no human replay.
 * Sometimes finishes inside the clock, sometimes stops short of it.
 */
export function buildSolverSchedule(matchDurationMs: number, seed: number): GhostEvent[] {
  const pace = solverPaceFromSeed(seed);
  const targetMs = Math.max(15_000, Math.round(matchDurationMs * pace));
  const finishes = targetMs <= matchDurationMs;
  const endMs = Math.min(matchDurationMs, targetMs);
  const reached = finishes
    ? 100
    : Math.min(99, Math.max(1, Math.round(100 * matchDurationMs / targetMs)));

  const marks = new Set<number>();
  for (let t = SOLVER_STEP_MS; t < endMs; t += SOLVER_STEP_MS) {
    const jitter = (mix(seed + t) % 700) - 350;
    marks.add(Math.max(1_000, Math.min(endMs, t + jitter)));
  }
  marks.add(endMs);

  const events: GhostEvent[] = [];
  let lastProgress = 0;
  for (const atMs of [...marks].sort((a, b) => a - b)) {
    const progress = Math.min(reached, Math.round(reached * atMs / endMs));
    if (progress > lastProgress) {
      events.push({ atMs, type: 'progress', progress });
      lastProgress = progress;
    }
  }

  if (finishes) {
    if (lastProgress < 100) {
      events.push({ atMs: endMs, type: 'progress', progress: 100 });
    }
    events.push({ atMs: endMs, type: 'finish' });
  }

  events.sort((a, b) => a.atMs - b.atMs || typeRank(a.type) - typeRank(b.type));
  return events;
}
