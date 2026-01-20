import mongoose, { Schema, Document } from 'mongoose';

export interface IProgressCell {
  row: number;
  col: number;
  value: string;
  locked: boolean;
}

export interface IUserPuzzleProgress extends Document {
  userId: mongoose.Types.ObjectId;
  puzzleId: mongoose.Types.ObjectId;
  cells: IProgressCell[];
  completedCluesCount: number;
  totalClues: number;
  isCompleted: boolean;
  elapsedTime: number;
  bestTime: number | null;
  lastPlayedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const progressCellSchema = new Schema({
  row: { type: Number, required: true },
  col: { type: Number, required: true },
  value: { type: String, required: true },
  locked: { type: Boolean, default: false }
}, { _id: false });

const userPuzzleProgressSchema = new Schema<IUserPuzzleProgress>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  puzzleId: {
    type: Schema.Types.ObjectId,
    ref: 'Puzzle',
    required: true
  },
  cells: {
    type: [progressCellSchema],
    default: []
  },
  completedCluesCount: {
    type: Number,
    default: 0
  },
  totalClues: {
    type: Number,
    required: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  elapsedTime: {
    type: Number,
    default: 0
  },
  bestTime: {
    type: Number,
    default: null
  },
  lastPlayedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userPuzzleProgressSchema.index({ userId: 1, puzzleId: 1 }, { unique: true });
userPuzzleProgressSchema.index({ userId: 1 });

export const UserPuzzleProgress = mongoose.model<IUserPuzzleProgress>('UserPuzzleProgress', userPuzzleProgressSchema);