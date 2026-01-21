import mongoose, { Schema, Document } from 'mongoose';
import { PuzzleGrid, Difficulty, PuzzleItem } from '../types';

export interface IPuzzle extends Document {
  title: string;
  difficulty: Difficulty;
  category: string;
  grid: PuzzleGrid;
  puzzleItems: PuzzleItem[];
  estimatedTime: number;
  coinReward: number;
  isActive: boolean;
  packageId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const puzzleItemSchema = new Schema({
  number: { type: Number, required: true },
  direction: { type: String, enum: ['across', 'down', 'right-down', 'left-down', 'down-across', 'up-across'], required: true },
  clue: { type: String, required: true },
  answer: { type: String, required: true },
  startRow: { type: Number, required: true },
  startCol: { type: Number, required: true },
  enumeration: { type: [Number], required: true},
}, { _id: false });

const puzzleSchema = new Schema<IPuzzle>({
  title: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: Object.values(Difficulty),
    required: true
  },
  category: {
    type: String,
    required: true
  },
  grid: {
    rows: { type: Number, required: true },
    cols: { type: Number, required: true }
  },
  puzzleItems: {
    type: [puzzleItemSchema],
    required: true
  },
  estimatedTime: {
    type: Number,
    required: true
  },
  coinReward: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  packageId: {
    type: Schema.Types.ObjectId,
    ref: 'PuzzlePackage',
    required: false
  }
}, {
  timestamps: true
});

puzzleSchema.index({ difficulty: 1, isActive: 1 });
puzzleSchema.index({ category: 1, isActive: 1 });
puzzleSchema.index({ packageId: 1 });

export const Puzzle = mongoose.model<IPuzzle>('Puzzle', puzzleSchema);