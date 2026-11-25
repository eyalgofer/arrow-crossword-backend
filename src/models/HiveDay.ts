import mongoose, { Document, Schema } from 'mongoose';

/**
 * The hive pinned for one Israel date (`YYYY-MM-DD`).
 * Chosen once. A later clue-file edit does not change this day.
 * `answers` stays on the server. The client never receives it.
 */
export interface IHiveDay extends Document {
  date: string;
  center: string;
  outer: string[];
  answers: string[];
  maxScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const hiveDaySchema = new Schema<IHiveDay>(
  {
    date: {
      type: String,
      required: true,
      unique: true,
    },
    center: {
      type: String,
      required: true,
    },
    outer: {
      type: [String],
      required: true,
    },
    answers: {
      type: [String],
      required: true,
    },
    maxScore: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'hiveDays',
  }
);

export const HiveDay = mongoose.model<IHiveDay>('HiveDay', hiveDaySchema);
