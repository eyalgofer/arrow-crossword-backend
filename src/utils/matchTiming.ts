import {
  MATCH_NORMAL_DURATION_SECONDS,
  MATCH_QUICK_DURATION_SECONDS
} from '../constants/match';
import { MatchMode } from '../types';
import { MatchSettings, resolveMatchMode } from './matchSettings';

export interface MatchTiming {
  startedAt: Date;
  durationSeconds: number | null;
  endsAt: Date | null;
  timed: boolean;
}

export function createMatchTiming(
  settings: MatchSettings,
  from: Date = new Date()
): MatchTiming {
  const startedAt = from;
  const timed = settings.mode === MatchMode.QUICK ? true : settings.timed;

  if (!timed) {
    return {
      startedAt,
      durationSeconds: null,
      endsAt: null,
      timed: false
    };
  }

  const durationSeconds = settings.mode === MatchMode.QUICK
    ? MATCH_QUICK_DURATION_SECONDS
    : MATCH_NORMAL_DURATION_SECONDS;

  return {
    startedAt,
    durationSeconds,
    endsAt: new Date(startedAt.getTime() + durationSeconds * 1000),
    timed: true
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

  const mode = resolveMatchMode(match);
  const fallbackDuration = mode === MatchMode.QUICK
    ? MATCH_QUICK_DURATION_SECONDS
    : MATCH_NORMAL_DURATION_SECONDS;
  const durationSeconds = match.durationSeconds && match.durationSeconds > 0
    ? match.durationSeconds
    : fallbackDuration;
  const endsAt = toDate(match.endsAt) ?? new Date(startedAt.getTime() + durationSeconds * 1000);

  return { startedAt, durationSeconds, endsAt, timed: true };
}

export function isTimedMatch(match: {
  timed?: boolean;
  endsAt?: Date | string | null;
  durationSeconds?: number | null;
}): boolean {
  if (match.timed === false) {
    return false;
  }
  if (match.timed === true) {
    return true;
  }
  return match.endsAt != null || (match.durationSeconds != null && match.durationSeconds > 0);
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
