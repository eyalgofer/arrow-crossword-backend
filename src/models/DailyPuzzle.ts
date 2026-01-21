import mongoose, { Schema, Document } from 'mongoose';

export interface IDailyPuzzle extends Document {
  puzzleId: mongoose.Types.ObjectId;
  dayOfYear: number; // 1-365 (or 366 for leap years)
  year: number; // Store year to handle year transitions
  date: Date; // The actual date this puzzle is assigned to
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
    required: true,
    unique: true // Ensure only one puzzle per day
  }
}, {
  timestamps: true
});

// Index for fast lookups by day of year and year
dailyPuzzleSchema.index({ dayOfYear: 1, year: 1 }, { unique: true });
// Index for date lookups
dailyPuzzleSchema.index({ date: 1 });
// Index for puzzleId lookups (if you need to find which days a puzzle was used)
dailyPuzzleSchema.index({ puzzleId: 1 });

export const DailyPuzzle = mongoose.model<IDailyPuzzle>('DailyPuzzle', dailyPuzzleSchema);
