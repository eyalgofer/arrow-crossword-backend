import { MatchMode } from '../types';
import {
  MATCH_NORMAL_DURATION_SECONDS,
  MATCH_QUICK_DURATION_SECONDS
} from '../constants/match';

export interface MatchSettings {
  mode: MatchMode;
  timed: boolean;
}

export function parseMatchSettings(input?: {
  mode?: unknown;
  gameMode?: unknown;
  matchMode?: unknown;
  timed?: unknown;
  timeLimit?: unknown;
  hasTimeLimit?: unknown;
  timerEnabled?: unknown;
  unlimited?: unknown;
  settings?: unknown;
} | null): MatchSettings {
  const nested = isRecord(input?.settings) ? input.settings : undefined;
  const source: Record<string, unknown> = {
    ...(nested ?? {}),
    ...(isRecord(input) ? input : {})
  };

  const rawMode = String(
    source.mode ?? source.gameMode ?? source.matchMode ?? ''
  ).toLowerCase().replace(/[_-]/g, '');
  const mode = rawMode === MatchMode.QUICK || rawMode === 'quickgame'
    ? MatchMode.QUICK
    : MatchMode.NORMAL;

  if (mode === MatchMode.QUICK) {
    return { mode, timed: true };
  }

  if (source.unlimited === true || source.unlimited === 'true') {
    return { mode, timed: false };
  }

  const timedFlag = source.timed ?? source.hasTimeLimit ?? source.timerEnabled
    ?? (typeof source.timeLimit === 'boolean' ? source.timeLimit : undefined);

  const timed = timedFlag !== false && timedFlag !== 'false' && timedFlag !== 0;
  return { mode, timed };
}

export function durationSecondsForSettings(settings: MatchSettings): number | null {
  if (settings.mode === MatchMode.QUICK) {
    return MATCH_QUICK_DURATION_SECONDS;
  }
  if (!settings.timed) {
    return null;
  }
  return MATCH_NORMAL_DURATION_SECONDS;
}

export function resolveMatchMode(match: { mode?: string }): MatchMode {
  return match.mode === MatchMode.QUICK ? MatchMode.QUICK : MatchMode.NORMAL;
}

export function isQuickMatch(match: { mode?: string }): boolean {
  return resolveMatchMode(match) === MatchMode.QUICK;
}

export function matchSettingsKey(settings: MatchSettings): string {
  return `${settings.mode}:${settings.timed ? 'timed' : 'untimed'}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
