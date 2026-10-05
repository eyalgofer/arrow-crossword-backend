import mongoose, { Schema, Document } from 'mongoose';
import { Language, MatchMode } from '../types';

export type LobbyStatus = 'waiting' | 'started' | 'cancelled';
export type SeatStatus = 'joined' | 'invited' | 'declined' | 'left';

export interface ILobbySeat {
  userId: mongoose.Types.ObjectId;
  displayName: string;
  photoURL?: string | null;
  status: SeatStatus;
  isHost: boolean;
}

export interface ILobby extends Document {
  hostId: mongoose.Types.ObjectId;
  groupId?: mongoose.Types.ObjectId | null;
  status: LobbyStatus;
  mode: MatchMode;
  timed: boolean;
  language: Language;
  seats: ILobbySeat[];
  matchId?: mongoose.Types.ObjectId | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const seatSchema = new Schema<ILobbySeat>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  displayName: { type: String, required: true },
  photoURL: { type: String, default: null },
  status: {
    type: String,
    enum: ['joined', 'invited', 'declined', 'left'],
    required: true
  },
  isHost: { type: Boolean, required: true }
}, { _id: false });

const lobbySchema = new Schema<ILobby>({
  hostId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  groupId: {
    type: Schema.Types.ObjectId,
    ref: 'Group',
    default: null
  },
  status: {
    type: String,
    enum: ['waiting', 'started', 'cancelled'],
    default: 'waiting',
    index: true
  },
  mode: {
    type: String,
    enum: Object.values(MatchMode),
    required: true
  },
  timed: {
    type: Boolean,
    required: true
  },
  language: {
    type: String,
    enum: ['en', 'he'],
    default: 'en'
  },
  seats: {
    type: [seatSchema],
    required: true
  },
  matchId: {
    type: Schema.Types.ObjectId,
    ref: 'Match',
    default: null
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

lobbySchema.index({ status: 1, expiresAt: 1 });
lobbySchema.index({ hostId: 1, status: 1 });
lobbySchema.index({ 'seats.userId': 1, status: 1 });

export const Lobby = mongoose.model<ILobby>('Lobby', lobbySchema);
