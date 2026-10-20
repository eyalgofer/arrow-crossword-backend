import mongoose from 'mongoose';
import { OVERNIGHT_DAILY_PRIZE_COINS } from '../constants/daily';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import {
  DailyProfilePlacements,
  SolvedDaily,
  dateStringFromDailyKey,
  placementsForSolves,
  toLocalDateString,
} from '../utils/dailyPuzzleStats';

/**
 * Profile fields that move after the solve is stored: prize wins, best finish,
 * and the last 7 days. Ranks are read from current best times, so a later
 * solver updates today's place on the next fetch. Wins count dailies whose
 * overnight prize was actually paid to this user.
 */
export async function loadDailyProfilePlacements(
  userId: mongoose.Types.ObjectId,
  now: Date = new Date()
): Promise<DailyProfilePlacements> {
  const today = toLocalDateString(now);

  const [wins, myCompleted] = await Promise.all([
    DailyPuzzle.countDocuments({
      fastestSolverId: userId,
      overnightPrizeAwardedAt: { $ne: null },
    }),
    UserPuzzleProgress.find({ userId, isCompleted: true })
      .select('puzzleId bestTime')
      .lean(),
  ]);

  const completedIds = myCompleted.map((row) => row.puzzleId);
  const assignments = completedIds.length
    ? await DailyPuzzle.find({ puzzleId: { $in: completedIds } })
        .select('puzzleId year dayOfYear')
        .lean()
    : [];

  const datesByPuzzle = new Map<string, string[]>();
  for (const row of assignments) {
    const key = String(row.puzzleId);
    const dates = datesByPuzzle.get(key) ?? [];
    dates.push(dateStringFromDailyKey(row.year, row.dayOfYear));
    datesByPuzzle.set(key, dates);
  }

  const dailyIds = [...datesByPuzzle.keys()];
  const others = dailyIds.length
    ? await UserPuzzleProgress.find({
        userId: { $ne: userId },
        puzzleId: { $in: assignments.map((row) => row.puzzleId) },
        isCompleted: true,
        bestTime: { $gt: 0 },
      })
        .select('puzzleId bestTime')
        .lean()
    : [];

  const mine: SolvedDaily[] = myCompleted
    .filter((row) => datesByPuzzle.has(String(row.puzzleId)))
    .map((row) => ({
      puzzleId: String(row.puzzleId),
      bestTime: typeof row.bestTime === 'number' ? row.bestTime : null,
      dates: datesByPuzzle.get(String(row.puzzleId)) ?? [],
    }));

  const { bestPlacement, last7 } = placementsForSolves(
    today,
    mine,
    others.map((row) => ({
      puzzleId: String(row.puzzleId),
      bestTime: row.bestTime as number,
    }))
  );

  return {
    solvedCount: mine.length,
    wins,
    coinsWon: wins * OVERNIGHT_DAILY_PRIZE_COINS,
    bestPlacement,
    last7,
  };
}
