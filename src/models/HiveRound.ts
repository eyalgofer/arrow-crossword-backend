import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * One player's found words for one Israel date.
 * `found` is normalized and sorted. `score` is the sum of those words.
 */
export interface IHiveRound extends Document {
  userId: Types.ObjectId;
  date: string;
  found: string[];
  score: number;
  /** Whole seconds spent playing. Stops when the daily target is reached. */
  elapsedSeconds?: number | null;
  completionSeconds?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const hiveRoundSchema = new Schema<IHiveRound>(
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
    found: {
      type: [String],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
      required: true,
    },
    elapsedSeconds: {
      type: Number,
      default: 0,
    },
    completionSeconds: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'hiveRounds',
  }
);

hiveRoundSchema.index({ userId: 1, date: 1 }, { unique: true });

export const HiveRound = mongoose.model<IHiveRound>('HiveRound', hiveRoundSchema);
