import mongoose, { Schema, Document } from 'mongoose';
import { Language } from '../types';

export interface IMultiplayerPuzzle extends Document {
  puzzleId: mongoose.Types.ObjectId;
  index: number; // 0-9 to identify which multiplayer puzzle this is
  language: Language;
  createdAt: Date;
  updatedAt: Date;
}

const multiplayerPuzzleSchema = new Schema<IMultiplayerPuzzle>({
  puzzleId: {
    type: Schema.Types.ObjectId,
    ref: 'Puzzle',
    required: true
  },
  index: {
    type: Number,
    required: true,
    min: 0,
    max: 9
  },
  language: {
    type: String,
    enum: ['en', 'he'],
    default: 'en'
  }
}, {
  timestamps: true
});

// One puzzle per slot per language (English and Hebrew pools coexist)
multiplayerPuzzleSchema.index({ index: 1, language: 1 }, { unique: true });
multiplayerPuzzleSchema.index({ language: 1 });
multiplayerPuzzleSchema.index({ puzzleId: 1 });

export const MultiplayerPuzzle = mongoose.model<IMultiplayerPuzzle>('MultiplayerPuzzle', multiplayerPuzzleSchema);
