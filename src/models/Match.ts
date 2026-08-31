import mongoose, { Schema, Document } from 'mongoose';
import { ClaimedWord, MatchCompletionReason, MatchMode, MatchStatus, PlayerMove } from '../types';

export interface IMatchPlayer {
  userId: mongoose.Types.ObjectId;
  displayName: string;
  photoURL: string;
  progress: number;
  claimedCount: number;
  completedAt?: Date;
}

export interface IMatch extends Document {
  players: IMatchPlayer[];
  puzzleId: mongoose.Types.ObjectId;
  status: MatchStatus;
  moves: PlayerMove[];
  claimedWords: ClaimedWord[];
  mode: MatchMode;
  timed: boolean;
  winnerId?: mongoose.Types.ObjectId | null;
  startedAt?: Date;
  durationSeconds?: number | null;
  endsAt?: Date | null;
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

const claimedWordSchema = new Schema({
  clueId: { type: String, required: true },
  answer: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  displayName: { type: String, required: true },
  claimedAt: { type: Date, default: Date.now }
}, { _id: false });

const matchSchema = new Schema<IMatch>({
  players: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    displayName: { type: String, required: true },
    photoURL: { type: String },
    progress: { type: Number, default: 0 },
    claimedCount: { type: Number, default: 0 },
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
  claimedWords: {
    type: [claimedWordSchema],
    default: []
  },
  mode: {
    type: String,
    enum: Object.values(MatchMode),
    default: MatchMode.NORMAL
  },
  timed: {
    type: Boolean,
    default: true
  },
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
    default: null
  },
  endsAt: {
    type: Date,
    default: null
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
