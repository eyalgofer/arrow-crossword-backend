import mongoose, { Schema, Document } from 'mongoose';

export interface IPuzzlePackage extends Document {
  name: string;
  description?: string;
  theme: string;
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
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: false
  },
  theme: {
    type: String,
    required: true
  },
  puzzleCount: {
    type: Number,
    required: true,
    validate: {
      validator: (v: number) => v === 5 || v === 20,
      message: 'puzzleCount must be 5 or 20'
    }
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

export const PuzzlePackage = mongoose.model<IPuzzlePackage>('PuzzlePackage', puzzlePackageSchema);
