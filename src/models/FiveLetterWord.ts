import mongoose, { Document, FilterQuery, Schema } from 'mongoose';
import { jerusalemHourKey } from '../utils/dailyClock';
import { disablesFiveLetterWord, isFiveLetterWord, normalizeFiveWord } from '../utils/fiveLetters';
import { FiveLetterDay } from './FiveLetterDay';

/**
 * Fallback answer pool when the clue lexicon is missing.
 * Disabled rows are not used as that fallback.
 *
 * Do not delete or disable the row assigned to the current Israel hour.
 * `FiveLetterDay` keeps that word for the rest of the hour; removing it would
 * make a later read disagree with guesses already marked.
 */
export interface IFiveLetterWord extends Document {
  word: string;
  locale: 'he';
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const fiveLetterWordSchema = new Schema<IFiveLetterWord>(
  {
    word: {
      type: String,
      required: true,
      set: (value: string) => normalizeFiveWord(value),
      validate: {
        validator: (value: string) => isFiveLetterWord(value),
        message: 'word must be five Hebrew letters',
      },
    },
    locale: {
      type: String,
      enum: ['he'],
      default: 'he',
      required: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'fiveLetterWords',
  }
);

// `enabled` is part of the key so the partial filter is valid, and uniqueness
// still applies only to enabled rows (disabled duplicates are not indexed).
fiveLetterWordSchema.index(
  { word: 1, enabled: 1 },
  { unique: true, partialFilterExpression: { enabled: true } }
);
fiveLetterWordSchema.index({ enabled: 1, locale: 1 });

const ASSIGNED_WORD_ERROR = 'Cannot delete or disable the five-letter word assigned this hour';

async function refuseIfAssignedToday(filter: FilterQuery<IFiveLetterWord>): Promise<void> {
  const day = await FiveLetterDay.findOne({ date: jerusalemHourKey() }).select('wordId').lean();
  if (!day?.wordId) return;
  const match = await FiveLetterWord.exists({ $and: [filter, { _id: day.wordId }] });
  if (match) throw new Error(ASSIGNED_WORD_ERROR);
}

async function guardDisable(this: mongoose.Query<unknown, IFiveLetterWord>): Promise<void> {
  if (!disablesFiveLetterWord(this.getUpdate())) return;
  await refuseIfAssignedToday(this.getFilter());
}

async function guardDelete(this: mongoose.Query<unknown, IFiveLetterWord>): Promise<void> {
  await refuseIfAssignedToday(this.getFilter());
}

fiveLetterWordSchema.pre('save', async function () {
  if (this.isNew || this.enabled !== false || !this.isModified('enabled')) return;
  await refuseIfAssignedToday({ _id: this._id });
});

for (const hook of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'] as const) {
  fiveLetterWordSchema.pre(hook, guardDisable);
}
for (const hook of ['deleteMany', 'findOneAndDelete'] as const) {
  fiveLetterWordSchema.pre(hook, guardDelete);
}
fiveLetterWordSchema.pre('deleteOne', { document: false, query: true }, guardDelete);
fiveLetterWordSchema.pre('deleteOne', { document: true, query: false }, async function () {
  await refuseIfAssignedToday({ _id: this._id });
});

export const FiveLetterWord = mongoose.model<IFiveLetterWord>(
  'FiveLetterWord',
  fiveLetterWordSchema
);
