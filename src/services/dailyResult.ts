import mongoose from 'mongoose';
import { OVERNIGHT_DAILY_PRIZE_COINS } from '../constants/daily';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';

export interface DailyResultPayload {
  rank: number;
  totalSolvers: number;
  fastestTimeSec: number;
  prizeCoins: number;
}

/** Competition rank: 1 + count of solvers with a strictly better time (ties share place). */
export function competitionRank(fasterCount: number): number {
  return Math.max(0, Math.floor(fasterCount)) + 1;
}

/**
 * Whether a new completion should take the overnight #1 prize claim.
 * Equal times do not steal an existing claim (first to set keeps it).
 */
export function shouldClaimFastestPrize(
  currentFastestSec: number | null | undefined,
  completionSeconds: number
): boolean {
  if (!(completionSeconds > 0)) return false;
  if (currentFastestSec == null || !Number.isFinite(currentFastestSec)) return true;
  return completionSeconds < currentFastestSec;
}

export async function buildDailyResult(
  puzzleId: mongoose.Types.ObjectId | string,
  userBestTimeSec: number
): Promise<DailyResultPayload | null> {
  const id =
    typeof puzzleId === 'string'
      ? new mongoose.Types.ObjectId(puzzleId)
      : puzzleId;

  const myTime = Math.floor(userBestTimeSec);
  if (!(myTime > 0)) {
    return null;
  }

  const [stats] = await UserPuzzleProgress.aggregate<{
    totalSolvers: number;
    fasterCount: number;
    fastestTimeSec: number | null;
  }>([
    { $match: { puzzleId: id, isCompleted: true } },
    {
      $group: {
        _id: null,
        totalSolvers: { $sum: 1 },
        fasterCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: ['$bestTime', 0] },
                  { $lt: ['$bestTime', myTime] },
                ],
              },
              1,
              0,
            ],
          },
        },
        fastestTimeSec: {
          $min: {
            $cond: [{ $gt: ['$bestTime', 0] }, '$bestTime', null],
          },
        },
      },
    },
  ]);

  const fastestRaw = stats?.fastestTimeSec;
  const fastestTimeSec =
    typeof fastestRaw === 'number' && Number.isFinite(fastestRaw)
      ? Math.floor(fastestRaw)
      : myTime;

  return {
    rank: competitionRank(stats?.fasterCount ?? 0),
    totalSolvers: stats?.totalSolvers ?? 1,
    fastestTimeSec,
    prizeCoins: OVERNIGHT_DAILY_PRIZE_COINS,
  };
}

/**
 * Atomically claim / keep overnight #1 when this completion is strictly faster
 * (or first timed complete). Equal times leave the existing claim holder.
 */
export async function maybeClaimOvernightFastest(params: {
  puzzleId: mongoose.Types.ObjectId | string;
  userId: mongoose.Types.ObjectId;
  completionSeconds: number;
}): Promise<void> {
  const completionSeconds = Math.floor(params.completionSeconds);
  if (!(completionSeconds > 0)) return;

  const puzzleId =
    typeof params.puzzleId === 'string'
      ? new mongoose.Types.ObjectId(params.puzzleId)
      : params.puzzleId;

  await DailyPuzzle.findOneAndUpdate(
    {
      puzzleId,
      $or: [
        { fastestTimeSec: null },
        { fastestTimeSec: { $exists: false } },
        { fastestTimeSec: { $gt: completionSeconds } },
      ],
    },
    {
      $set: {
        fastestSolverId: params.userId,
        fastestTimeSec: completionSeconds,
        fastestClaimedAt: new Date(),
      },
    }
  );
}
