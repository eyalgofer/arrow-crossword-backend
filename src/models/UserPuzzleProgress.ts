import mongoose, { Schema, Document } from 'mongoose';

export interface IUserPuzzleProgress extends Document {
  userId: mongoose.Types.ObjectId;
  puzzleId: mongoose.Types.ObjectId;
  state: string[][];
  completed: boolean;
  timeSpent: number;
  hintsUsed: number;
  correctCells: number;
  totalCells: number;
  startedAt: Date;
  completedAt?: Date;
  lastPlayedAt: Date;
}

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
  state: {
    type: [[String]],
    required: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  timeSpent: {
    type: Number,
    default: 0
  },
  hintsUsed: {
    type: Number,
    default: 0
  },
  correctCells: {
    type: Number,
    default: 0
  },
  totalCells: {
    type: Number,
    required: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  lastPlayedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

userPuzzleProgressSchema.index({ userId: 1, puzzleId: 1 }, { unique: true });
userPuzzleProgressSchema.index({ userId: 1, completed: 1 });

export const UserPuzzleProgress = mongoose.model<IUserPuzzleProgress>('UserPuzzleProgress', userPuzzleProgressSchema);