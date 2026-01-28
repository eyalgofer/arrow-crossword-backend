import mongoose, { Schema, Document } from 'mongoose';

export interface IMultiplayerPuzzle extends Document {
  puzzleId: mongoose.Types.ObjectId;
  index: number; // 0-9 to identify which multiplayer puzzle this is
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
    max: 9,
    unique: true // Ensure only one puzzle per index
  }
}, {
  timestamps: true
});

// Index for fast lookups by index
multiplayerPuzzleSchema.index({ index: 1 }, { unique: true });
// Index for puzzleId lookups
multiplayerPuzzleSchema.index({ puzzleId: 1 });

export const MultiplayerPuzzle = mongoose.model<IMultiplayerPuzzle>('MultiplayerPuzzle', multiplayerPuzzleSchema);
