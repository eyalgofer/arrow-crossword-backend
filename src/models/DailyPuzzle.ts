import mongoose, { Schema, Document } from 'mongoose';
import { Language } from '../types';

export interface IDailyPuzzle extends Document {
  puzzleId: mongoose.Types.ObjectId;
  dayOfYear: number; // 1-365 (or 366 for leap years)
  year: number; // Store year to handle year transitions
  date: Date; // The actual date this puzzle is assigned to
  language: Language; // Each language gets its own daily puzzle
  createdAt: Date;
  updatedAt: Date;
}

const dailyPuzzleSchema = new Schema<IDailyPuzzle>({
  puzzleId: {
    type: Schema.Types.ObjectId,
    ref: 'Puzzle',
    required: true
  },
  dayOfYear: {
    type: Number,
    required: true,
    min: 1,
    max: 366
  },
  year: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  language: {
    type: String,
    enum: ['en', 'he'],
    default: 'en'
  }
}, {
  timestamps: true
});

// One puzzle per day per language
dailyPuzzleSchema.index({ dayOfYear: 1, year: 1, language: 1 }, { unique: true });
dailyPuzzleSchema.index({ date: 1, language: 1 }, { unique: true });
// Index for puzzleId lookups (if you need to find which days a puzzle was used)
dailyPuzzleSchema.index({ puzzleId: 1 });

export const DailyPuzzle = mongoose.model<IDailyPuzzle>('DailyPuzzle', dailyPuzzleSchema);
