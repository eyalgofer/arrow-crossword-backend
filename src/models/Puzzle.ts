import mongoose, { Schema, Document } from 'mongoose';
import { PuzzleGrid, PuzzleClue, Difficulty } from '../types';

export interface IPuzzle extends Document {
  title: string;
  difficulty: Difficulty;
  category: string;
  grid: PuzzleGrid;
  clues: PuzzleClue[];
  estimatedTime: number;
  xpReward: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const puzzleClueSchema = new Schema({
  number: { type: Number, required: true },
  direction: { type: String, enum: ['across', 'down'], required: true },
  clue: { type: String, required: true },
  answer: { type: String, required: true },
  startRow: { type: Number, required: true },
  startCol: { type: Number, required: true }
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
    cols: { type: Number, required: true },
    cells: [[String]]
  },
  clues: {
    type: [puzzleClueSchema],
    required: true
  },
  estimatedTime: {
    type: Number,
    required: true
  },
  xpReward: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

puzzleSchema.index({ difficulty: 1, isActive: 1 });
puzzleSchema.index({ category: 1, isActive: 1 });

export const Puzzle = mongoose.model<IPuzzle>('Puzzle', puzzleSchema);