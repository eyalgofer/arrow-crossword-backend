import mongoose, { Schema, Document } from 'mongoose';
import { UserStats } from '../types';

export interface IUser extends Document {
  firebaseUid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  coins: number;
  stats: UserStats;
  preferences: {
    soundEnabled: boolean;
    vibrationEnabled: boolean;
    narrationEnabled: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  photoURL: {
    type: String
  },
  coins: {
    type: Number,
    default: 0
  },
  stats: {
    totalGames: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    totalTime: { type: Number, default: 0 },
    averageTime: { type: Number, default: 0 },
    fastestTime: { type: Number, default: 0 }
  },
  preferences: {
    soundEnabled: { type: Boolean, default: true },
    vibrationEnabled: { type: Boolean, default: true },
    narrationEnabled: { type: Boolean, default: true }  
  }
}, {
  timestamps: true
});

userSchema.index({ coins: -1 });

export const User = mongoose.model<IUser>('User', userSchema);