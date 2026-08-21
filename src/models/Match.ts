import mongoose, { Schema, Document } from 'mongoose';
import { MatchCompletionReason, MatchStatus, PlayerMove } from '../types';
import { MATCH_DURATION_SECONDS } from '../constants/match';

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
  winnerId?: mongoose.Types.ObjectId | null;
  startedAt?: Date;
  durationSeconds: number;
  endsAt?: Date;
  completedAt?: Date;
  completionReason?: MatchCompletionReason;
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
    photoURL: { type: String },
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
    ref: 'User',
    default: null
  },
  startedAt: {
    type: Date
  },
  durationSeconds: {
    type: Number,
    default: MATCH_DURATION_SECONDS
  },
  endsAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  completionReason: {
    type: String,
    enum: Object.values(MatchCompletionReason)
  }
}, {
  timestamps: true
});

matchSchema.index({ status: 1, createdAt: -1 });
matchSchema.index({ status: 1, endsAt: 1 });
matchSchema.index({ 'players.userId': 1, createdAt: -1 });

export const Match = mongoose.model<IMatch>('Match', matchSchema);
