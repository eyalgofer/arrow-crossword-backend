import { MatchMode } from '../types';

export interface MatchSettings {
  mode: MatchMode;
  timed: boolean;
}

export function parseMatchSettings(input?: {
  mode?: unknown;
  timed?: unknown;
  timeLimit?: unknown;
}): MatchSettings {
  const rawMode = typeof input?.mode === 'string' ? input.mode.toLowerCase().replace(/[_-]/g, '') : '';
  const mode = rawMode === MatchMode.QUICK || rawMode === 'quickgame'
    ? MatchMode.QUICK
    : MatchMode.NORMAL;

  const timedFlag = input?.timed ?? input?.timeLimit;
  const timed = mode === MatchMode.QUICK
    ? true
    : timedFlag !== false && timedFlag !== 'false' && timedFlag !== 0;

  return { mode, timed };
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
