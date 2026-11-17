import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * The word pinned for one Israel hour (`YYYY-MM-DDTHH`), plus that hour's stats.
 * The word is chosen once. Later lexicon changes do not change this hour.
 * `solvedCount` and `fastestSeconds` reset by living on the next hour's row.
 * `fastestSolverId` is the prize holder. Coins and the push are written only
 * after the hour has ended.
 */
export interface IFiveLetterDay extends Document {
  date: string;
  wordId?: Types.ObjectId | null;
  word: string;
  solvedCount: number;
  fastestSeconds: number | null;
  fastestSolverId?: Types.ObjectId | null;
  prizeAwardedAt?: Date | null;
  prizeNotifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const fiveLetterDaySchema = new Schema<IFiveLetterDay>(
  {
    date: {
      type: String,
      required: true,
      unique: true,
    },
    wordId: {
      type: Schema.Types.ObjectId,
      ref: 'FiveLetterWord',
      default: null,
    },
    word: {
      type: String,
      required: true,
    },
    solvedCount: {
      type: Number,
      default: 0,
      required: true,
    },
    fastestSeconds: {
      type: Number,
      default: null,
    },
    fastestSolverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    prizeAwardedAt: {
      type: Date,
      default: null,
    },
    prizeNotifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'fiveLetterDays',
  }
);

export const FiveLetterDay = mongoose.model<IFiveLetterDay>(
  'FiveLetterDay',
  fiveLetterDaySchema
);
