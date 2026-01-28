import mongoose, { Schema, Document } from 'mongoose';

export interface IMultiplayerPuzzle extends Document {
  puzzleId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const multiplayerPuzzleSchema = new Schema<IMultiplayerPuzzle>({
  puzzleId: {
    type: Schema.Types.ObjectId,
    ref: 'Puzzle',
    required: true
  },
}, {
  timestamps: true
});

// Index for fast lookups by index
multiplayerPuzzleSchema.index({ index: 1 }, { unique: true });
// Index for puzzleId lookups
multiplayerPuzzleSchema.index({ puzzleId: 1 });

export const MultiplayerPuzzle = mongoose.model<IMultiplayerPuzzle>('MultiplayerPuzzle', multiplayerPuzzleSchema);
