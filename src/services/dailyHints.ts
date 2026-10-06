import mongoose from 'mongoose';
import { User } from '../models/User';
import { Puzzle } from '../models/Puzzle';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { isTodaysDailyPuzzle } from '../utils/dailyPuzzleUtils';
import { decideHintPurchase } from '../utils/dailyHints';

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error != null && (error as { code?: number }).code === 11000;
}

/** Leave the transaction without committing when the purchase does not write. */
async function finishReadOnly<T>(session: mongoose.ClientSession, value: T): Promise<T> {
  await session.abortTransaction();
  return value;
}

/**
 * Charge coins and, for today's daily, increment hintsUsed in one transaction.
 * A failed purchase does not consume a hint.
 */
export async function purchasePuzzleHint(args: {
  firebaseUid: string;
  puzzleId: string;
  cost: number;
}): Promise<{ status: number; body: object }> {
  const session = await mongoose.startSession();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await session.withTransaction(async () => {
          const user = await User.findOne({ firebaseUid: args.firebaseUid }).session(session);
          if (!user) {
            return finishReadOnly(session, { status: 404, body: { error: 'User not found' } });
          }

          const puzzle = await Puzzle.findById(args.puzzleId).session(session);
          if (!puzzle) {
            return finishReadOnly(session, { status: 404, body: { error: 'Puzzle not found' } });
          }

          const progress = await UserPuzzleProgress.findOne({
            userId: user._id,
            puzzleId: puzzle._id,
          }).session(session);

          const isTodaysDaily = await isTodaysDailyPuzzle(puzzle._id, session);
          const decision = decideHintPurchase({
            isTodaysDaily,
            hintsUsed: progress?.hintsUsed ?? 0,
            coins: user.coins,
            cost: args.cost,
          });

          if (decision.kind === 'limit') {
            return finishReadOnly(session, { status: 409, body: decision.body });
          }
          if (decision.kind === 'insufficient') {
            return finishReadOnly(session, { status: 400, body: { error: 'Insufficient coins' } });
          }

          const charged = await User.findOneAndUpdate(
            { _id: user._id, coins: { $gte: args.cost } },
            { $inc: { coins: -args.cost } },
            { new: true, session }
          );
          if (!charged) {
            return finishReadOnly(session, { status: 400, body: { error: 'Insufficient coins' } });
          }

          if (decision.incrementHints) {
            if (progress) {
              progress.hintsUsed = decision.nextHintsUsed;
              await progress.save({ session });
            } else {
              await new UserPuzzleProgress({
                userId: user._id,
                puzzleId: puzzle._id,
                totalClues: puzzle.puzzleItems?.length ?? 0,
                hintsUsed: decision.nextHintsUsed,
              }).save({ session });
            }
          }

          return {
            status: 200,
            body: {
              ...decision.body,
              coins: charged.coins,
            },
          };
        });
      } catch (error) {
        if (isDuplicateKey(error) && attempt < 2) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed to purchase hint');
  } finally {
    await session.endSession();
  }
}
