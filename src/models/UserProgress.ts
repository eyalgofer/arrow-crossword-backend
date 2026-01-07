import mongoose, { Schema, Document } from 'mongoose';

export interface IUserProgress extends Document {
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
// TODO: this is currently being handled in the client will pass it here soon
const userProgressSchema = new Schema<IUserProgress>({
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

userProgressSchema.index({ userId: 1, puzzleId: 1 }, { unique: true });
userProgressSchema.index({ userId: 1, completed: 1 });

export const UserProgress = mongoose.model<IUserProgress>('UserProgress', userProgressSchema);