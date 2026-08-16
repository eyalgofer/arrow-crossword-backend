import mongoose, { Schema, Document } from 'mongoose';
import { Language } from '../types';

export interface IPuzzlePackage extends Document {
  name: string;
  description?: string;
  theme: string;
  language: Language;
  puzzleCount: number;
  puzzleIds: mongoose.Types.ObjectId[];
  order: number;
  iconName?: string;
  gradientColors?: [string, string];
  createdAt: Date;
  updatedAt: Date;
}

const puzzlePackageSchema = new Schema<IPuzzlePackage>({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false
  },
  theme: {
    type: String,
    required: true
  },
  language: {
    type: String,
    enum: ['en', 'he'],
    default: 'en'
  },
  puzzleCount: {
    type: Number,
    required: true,
  },
  puzzleIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Puzzle'
  }],
  order: {
    type: Number,
    required: true
  },
  iconName: {
    type: String,
    required: false
  },
  gradientColors: {
    type: [String],
    validate: {
      validator: (v: string[]) => !v || v.length === 0 || v.length === 2,
      message: 'gradientColors must be an array of exactly 2 color strings'
    },
    required: false
  }
}, {
  timestamps: true
});

// Index for sorting by order
puzzlePackageSchema.index({ order: 1 });
puzzlePackageSchema.index({ language: 1, order: 1 });
puzzlePackageSchema.index({ name: 1, language: 1 }, { unique: true });

export const PuzzlePackage = mongoose.model<IPuzzlePackage>('PuzzlePackage', puzzlePackageSchema);
