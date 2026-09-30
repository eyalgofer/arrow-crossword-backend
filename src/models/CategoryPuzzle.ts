import mongoose, { Schema, Document } from 'mongoose';
import { Language } from '../types';

export const CATEGORY_PUZZLE_KEYS = [
  'food',
  'people',
  'sport',
  'language',
  'science',
  'geography',
  'culture',
] as const;

export type CategoryPuzzleKey = (typeof CATEGORY_PUZZLE_KEYS)[number];

export interface ICategoryPuzzle extends Document {
  puzzleId: mongoose.Types.ObjectId;
  order: number;
  language: Language;
  category: CategoryPuzzleKey;
  label: string;
  accent?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categoryPuzzleSchema = new Schema<ICategoryPuzzle>({
  puzzleId: {
    type: Schema.Types.ObjectId,
    ref: 'Puzzle',
    required: true,
  },
  order: {
    type: Number,
    required: true,
  },
  language: {
    type: String,
    enum: ['en', 'he'],
    default: 'he',
  },
  category: {
    type: String,
    enum: CATEGORY_PUZZLE_KEYS,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  accent: {
    type: String,
    required: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  collection: 'category_puzzles',
});

categoryPuzzleSchema.index({ language: 1, order: 1 }, { unique: true });
categoryPuzzleSchema.index({ language: 1, isActive: 1, order: 1 });
categoryPuzzleSchema.index({ puzzleId: 1 });

export const CategoryPuzzle = mongoose.model<ICategoryPuzzle>('CategoryPuzzle', categoryPuzzleSchema);
