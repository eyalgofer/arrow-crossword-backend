import mongoose, { Schema, Document } from 'mongoose';
import { invalidatePicks } from '../services/playTabStamp';
import { Language } from '../types';

export interface IFavPuzzle extends Document {
  puzzleId: mongoose.Types.ObjectId;
  order: number;
  language: Language;
  accent?: string;
  badge?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const favPuzzleSchema = new Schema<IFavPuzzle>({
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
    enum: ['en', 'he', 'he-en'],
    default: 'he',
  },
  accent: {
    type: String,
    required: false,
  },
  badge: {
    type: String,
    required: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  collection: 'fav_puzzles',
});

favPuzzleSchema.index({ language: 1, order: 1 }, { unique: true });
favPuzzleSchema.index({ language: 1, isActive: 1, order: 1 });
favPuzzleSchema.index({ puzzleId: 1 });

const dropPicks = () => {
  invalidatePicks();
};
favPuzzleSchema.post('save', dropPicks);
favPuzzleSchema.post('insertMany', dropPicks);
favPuzzleSchema.post('updateOne', dropPicks);
favPuzzleSchema.post('updateMany', dropPicks);
favPuzzleSchema.post('findOneAndUpdate', dropPicks);
favPuzzleSchema.post('replaceOne', dropPicks);
favPuzzleSchema.post('deleteOne', dropPicks);
favPuzzleSchema.post('deleteMany', dropPicks);

export const FavPuzzle = mongoose.model<IFavPuzzle>('FavPuzzle', favPuzzleSchema);
