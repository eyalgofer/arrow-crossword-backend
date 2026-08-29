import mongoose, { Schema, Document } from 'mongoose';

export interface IUserPuzzleProgress extends Document {
  userId: mongoose.Types.ObjectId;
  puzzleId: mongoose.Types.ObjectId;
  completedClueIds: string[]; // Format: "number|direction" (e.g., "1|across", "5|right-down")
  completedCluesCount: number;
  totalClues: number;
  isCompleted: boolean;
  elapsedTime: number;
  bestTime: number | null;
  lastPlayedAt: Date;
  createdAt: Date;
  updatedAt: Date;
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
  completedClueIds: {
    type: [String],
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
userPuzzleProgressSchema.index({ puzzleId: 1, isCompleted: 1 });

export const UserPuzzleProgress = mongoose.model<IUserPuzzleProgress>('UserPuzzleProgress', userPuzzleProgressSchema);