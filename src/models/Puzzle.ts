import mongoose, { Schema, Document } from 'mongoose';
import { PuzzleGrid, Difficulty, PuzzleItem, Language } from '../types';
import { publicEnumeration } from '../utils/enumeration';

export interface IPuzzle extends Document {
  title: string;
  difficulty: Difficulty;
  category: string;
  language: Language;
  grid: PuzzleGrid;
  puzzleItems: PuzzleItem[];
  estimatedTime: number;
  coinReward: number;
  isActive: boolean;
  packageId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

function omitSingleWordEnumeration(_doc: unknown, ret: Record<string, unknown>) {
  ret.enumeration = publicEnumeration(ret.enumeration as number[] | undefined);
  return ret;
}

function sanitizePuzzleEnumeration(_doc: unknown, ret: Record<string, unknown>) {
  if (Array.isArray(ret.puzzleItems)) {
    ret.puzzleItems = (ret.puzzleItems as Record<string, unknown>[]).map(item => {
      item.enumeration = publicEnumeration(item.enumeration as number[] | undefined);
      return item;
    });
  }
  return ret;
}

const puzzleItemSchema = new Schema({
  number: { type: Number, required: true },
  direction: { type: String, enum: ['across', 'down', 'right-down', 'left-down', 'down-across', 'up-across'], required: true },
  clue: { type: String, required: true },
  answer: { type: String, required: true },
  startRow: { type: Number, required: true },
  startCol: { type: Number, required: true },
  // Mixed so mongoose does not coerce a missing value into [] (the app renders []).
  enumeration: { type: Schema.Types.Mixed, default: null },
  clueType: { type: String, enum: ['text', 'image'], default: 'text' },
  imageUrl: { type: String, required: false },
  exitRow: { type: Number, required: false },
  exitCol: { type: Number, required: false },
}, {
  _id: false,
  toJSON: { transform: omitSingleWordEnumeration },
  toObject: { transform: omitSingleWordEnumeration },
});

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
  language: {
    type: String,
    enum: ['en', 'he'],
    default: 'en'
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
  timestamps: true,
  toJSON: { transform: sanitizePuzzleEnumeration },
  toObject: { transform: sanitizePuzzleEnumeration },
});

puzzleSchema.index({ difficulty: 1, isActive: 1 });
puzzleSchema.index({ category: 1, isActive: 1 });
puzzleSchema.index({ packageId: 1 });
puzzleSchema.index({ language: 1, isActive: 1 });

export const Puzzle = mongoose.model<IPuzzle>('Puzzle', puzzleSchema);