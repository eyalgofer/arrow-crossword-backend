import mongoose, { Schema, Document } from 'mongoose';
import { MatchStatus, PlayerMove } from '../types';

export interface IMatch extends Document {
  players: {
    userId: mongoose.Types.ObjectId;
    displayName: string;
    photoURL: string;
    progress: number;
    completedAt?: Date;
  }[];
  puzzleId: mongoose.Types.ObjectId;
  status: MatchStatus;
  moves: PlayerMove[];
  winnerId?: mongoose.Types.ObjectId;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

const playerMoveSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  row: { type: Number, required: true },
  col: { type: Number, required: true },
  letter: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const matchSchema = new Schema<IMatch>({
  players: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    displayName: { type: String, required: true },
    photoURL: { type: String, required: true },
    progress: { type: Number, default: 0 },
    completedAt: { type: Date }
  }],
  puzzleId: {
    type: Schema.Types.ObjectId,
    ref: 'Puzzle',
    required: true
  },
  status: {
    type: String,
    enum: Object.values(MatchStatus),
    default: MatchStatus.WAITING
  },
  moves: [playerMoveSchema],
  winnerId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

matchSchema.index({ status: 1, createdAt: -1 });
matchSchema.index({ 'players.userId': 1, createdAt: -1 });

export const Match = mongoose.model<IMatch>('Match', matchSchema);