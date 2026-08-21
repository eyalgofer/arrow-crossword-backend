import { MATCH_DURATION_SECONDS } from '../constants/match';

export interface MatchTiming {
  startedAt: Date;
  durationSeconds: number;
  endsAt: Date;
}

export function createMatchTiming(from: Date = new Date()): MatchTiming {
  const durationSeconds = MATCH_DURATION_SECONDS;
  return {
    startedAt: from,
    durationSeconds,
    endsAt: new Date(from.getTime() + durationSeconds * 1000)
  };
}

export function getMatchTimingFields(match: {
  startedAt?: Date | string;
  durationSeconds?: number;
  endsAt?: Date | string;
  createdAt?: Date | string;
}): MatchTiming {
  const startedAt = toDate(match.startedAt) ?? toDate(match.createdAt) ?? new Date();
  const durationSeconds = match.durationSeconds ?? MATCH_DURATION_SECONDS;
  const endsAt = toDate(match.endsAt) ?? new Date(startedAt.getTime() + durationSeconds * 1000);
  return { startedAt, durationSeconds, endsAt };
}

export function isMatchTimedOut(
  match: Parameters<typeof getMatchTimingFields>[0],
  now: Date = new Date()
): boolean {
  return getMatchTimingFields(match).endsAt.getTime() <= now.getTime();
}

export function withMatchTiming<T extends object>(match: T): T & MatchTiming {
  return {
    ...match,
    ...getMatchTimingFields(match as Parameters<typeof getMatchTimingFields>[0])
  };
}

function toDate(value?: Date | string): Date | undefined {
  if (!value) {
    return undefined;
  }
  return value instanceof Date ? value : new Date(value);
}
