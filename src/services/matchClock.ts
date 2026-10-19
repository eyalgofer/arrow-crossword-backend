import { IMatch, Match } from '../models/Match';
import { MatchStatus } from '../types';
import { createMatchTiming, getMatchTimingFields, MatchTiming } from '../utils/matchTiming';
import { parseMatchSettings } from '../utils/matchSettings';

const arrived = new Map<string, Set<string>>();

export interface ClockNote {
  timing: MatchTiming | null;
  /** True only for the join that first starts the clock. */
  startedNow: boolean;
}

/**
 * Random matches are created before anyone enters, so the clock waits until
 * every player has joined. A match_found sent during a boost ad stays valid,
 * and the board time starts when that player comes in after the ad.
 */
export async function noteLivePlayerJoined(match: IMatch, userId: string): Promise<ClockNote> {
  if (match.startedAt || match.opponentKind !== 'live') {
    return { timing: getMatchTimingFields(match), startedNow: false };
  }

  const matchId = match._id.toString();
  const joined = arrived.get(matchId) ?? new Set<string>();
  joined.add(userId);
  arrived.set(matchId, joined);
  if (joined.size < match.players.length) {
    return { timing: null, startedNow: false };
  }

  const settings = parseMatchSettings({ mode: match.mode, timed: match.timed });
  const timing = createMatchTiming(settings);
  const updated = await Match.findOneAndUpdate(
    {
      _id: match._id,
      status: MatchStatus.IN_PROGRESS,
      $or: [{ startedAt: { $exists: false } }, { startedAt: null }]
    },
    {
      $set: {
        startedAt: timing.startedAt,
        endsAt: timing.endsAt,
        durationSeconds: timing.durationSeconds,
        timed: timing.timed
      }
    },
    { new: true }
  );
  arrived.delete(matchId);
  if (!updated) {
    const current = await Match.findById(match._id);
    return {
      timing: current?.startedAt ? getMatchTimingFields(current) : null,
      startedNow: false
    };
  }
  match.startedAt = updated.startedAt;
  match.endsAt = updated.endsAt;
  match.durationSeconds = updated.durationSeconds;
  match.timed = updated.timed;
  return { timing, startedNow: true };
}
