import { IMatch, Match } from '../models/Match';
import { MatchStatus } from '../types';
import { createMatchTiming, getMatchTimingFields, MatchTiming } from '../utils/matchTiming';
import { parseMatchSettings } from '../utils/matchSettings';

export interface ClockNote {
  timing: MatchTiming | null;
  /** True only for the join that first starts the clock. */
  startedNow: boolean;
}

/**
 * Random matches are created before anyone enters. The clock starts when the
 * first player opens the board, after a boost ad, and the start is stored so
 * every server process shares the same end time.
 */
export async function noteLivePlayerJoined(match: IMatch): Promise<ClockNote> {
  if (match.startedAt || match.opponentKind !== 'live') {
    return { timing: getMatchTimingFields(match), startedNow: false };
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
