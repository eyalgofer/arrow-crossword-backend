import mongoose, { Document, Schema, Types } from 'mongoose';

export type FiveLetterRoundStatus = 'playing' | 'won' | 'lost';

export interface IFiveLetterGuess {
  word: string;
  marks: string[];
}

/**
 * One player's guesses for one Israel hour (`YYYY-MM-DDTHH`).
 * `entryPaid` is set once the 100-coin entry for that hour has been taken.
 * `winCounted` is set only after that win has been added to the hour's
 * solved count, so a retry cannot count the same player twice.
 */
export interface IFiveLetterRound extends Document {
  userId: Types.ObjectId;
  date: string;
  guesses: IFiveLetterGuess[];
  status: FiveLetterRoundStatus;
  elapsedSeconds: number | null;
  completionSeconds: number | null;
  winCounted: boolean;
  entryPaid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const guessSchema = new Schema<IFiveLetterGuess>(
  {
    word: { type: String, required: true },
    marks: { type: [String], required: true },
  },
  { _id: false }
);

const fiveLetterRoundSchema = new Schema<IFiveLetterRound>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    guesses: {
      type: [guessSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['playing', 'won', 'lost'],
      default: 'playing',
      required: true,
    },
    elapsedSeconds: {
      type: Number,
      default: null,
    },
    completionSeconds: {
      type: Number,
      default: null,
    },
    winCounted: {
      type: Boolean,
      default: false,
    },
    entryPaid: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'fiveLetterRounds',
  }
);

fiveLetterRoundSchema.index({ userId: 1, date: 1 }, { unique: true });
fiveLetterRoundSchema.index({ date: 1, status: 1, winCounted: 1 });

export const FiveLetterRound = mongoose.model<IFiveLetterRound>(
  'FiveLetterRound',
  fiveLetterRoundSchema
);
