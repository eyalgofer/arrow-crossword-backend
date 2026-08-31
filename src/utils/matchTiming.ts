import {
  MATCH_NORMAL_DURATION_SECONDS,
  MATCH_QUICK_DURATION_SECONDS
} from '../constants/match';
import { MatchMode } from '../types';
import {
  durationSecondsForSettings,
  MatchSettings,
  resolveMatchMode
} from './matchSettings';

export interface MatchTiming {
  startedAt: Date;
  durationSeconds: number | null;
  endsAt: Date | null;
  timed: boolean;
}

export interface SerializedMatchTiming {
  timed: boolean;
  startedAt: string;
  durationSeconds: number | null;
  endsAt: string | null;
}

export function createMatchTiming(
  settings: MatchSettings,
  from: Date = new Date()
): MatchTiming {
  const startedAt = from;
  const durationSeconds = durationSecondsForSettings(settings);
  const timed = durationSeconds != null;

  return {
    startedAt,
    durationSeconds,
    endsAt: timed && durationSeconds != null
      ? new Date(startedAt.getTime() + durationSeconds * 1000)
      : null,
    timed
  };
}

export function getMatchTimingFields(match: {
  mode?: string;
  timed?: boolean;
  startedAt?: Date | string;
  durationSeconds?: number | null;
  endsAt?: Date | string | null;
  createdAt?: Date | string;
}): MatchTiming {
  const startedAt = toDate(match.startedAt) ?? toDate(match.createdAt) ?? new Date();
  const timed = isTimedMatch(match);

  if (!timed) {
    return {
      startedAt,
      durationSeconds: null,
      endsAt: null,
      timed: false
    };
  }

  const storedDuration = Number(match.durationSeconds);
  const durationSeconds = Number.isFinite(storedDuration) && storedDuration > 0
    ? storedDuration
    : (resolveMatchMode(match) === MatchMode.QUICK
      ? MATCH_QUICK_DURATION_SECONDS
      : MATCH_NORMAL_DURATION_SECONDS);
  const endsAt = toDate(match.endsAt) ?? new Date(startedAt.getTime() + durationSeconds * 1000);

  return { startedAt, durationSeconds, endsAt, timed: true };
}

export function serializeTimingFields(timing: MatchTiming): SerializedMatchTiming {
  return {
    timed: timing.timed,
    startedAt: timing.startedAt.toISOString(),
    durationSeconds: timing.durationSeconds,
    endsAt: timing.endsAt ? timing.endsAt.toISOString() : null
  };
}

/** Untimed only when timed is explicitly false. Missing fields mean a timed game. */
export function isTimedMatch(match: {
  timed?: boolean;
}): boolean {
  return match.timed !== false;
}

export function isMatchTimedOut(
  match: Parameters<typeof getMatchTimingFields>[0],
  now: Date = new Date()
): boolean {
  const { endsAt, timed } = getMatchTimingFields(match);
  if (!timed || !endsAt) {
    return false;
  }
  return endsAt.getTime() <= now.getTime();
}

export function withMatchTiming<T extends object>(match: T): T & MatchTiming {
  return {
    ...match,
    ...getMatchTimingFields(match as Parameters<typeof getMatchTimingFields>[0])
  };
}

function toDate(value?: Date | string | null): Date | undefined {
  if (!value) {
    return undefined;
  }
  return value instanceof Date ? value : new Date(value);
}
