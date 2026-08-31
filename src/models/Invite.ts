import mongoose, { Schema, Document } from 'mongoose';
import { Language, MatchMode } from '../types';
import { durationSecondsForSettings, parseMatchSettings } from '../utils/matchSettings';

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired'
}

export interface IInvite extends Document {
  from: mongoose.Types.ObjectId;
  to: mongoose.Types.ObjectId;
  status: InviteStatus;
  language: Language;
  mode: MatchMode;
  timed: boolean;
  durationSeconds?: number | null;
  createdAt: Date;
  updatedAt: Date;
  respondedAt?: Date;
}

const inviteSchema = new Schema<IInvite>({
  from: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  to: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(InviteStatus),
    default: InviteStatus.PENDING,
    index: true
  },
  language: {
    type: String,
    enum: ['en', 'he'],
    default: 'en'
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
  durationSeconds: {
    type: Number,
    default: null
  },
  respondedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { transform: attachInviteTiming },
  toObject: { transform: attachInviteTiming }
});

// Compound index for efficient queries
inviteSchema.index({ to: 1, status: 1 });
inviteSchema.index(
  { from: 1, to: 1 },
  { unique: true, partialFilterExpression: { status: InviteStatus.PENDING } }
);

function attachInviteTiming(_doc: unknown, ret: Record<string, unknown>) {
  const settings = parseMatchSettings({
    mode: ret.mode,
    timed: ret.timed
  });
  ret.mode = settings.mode;
  ret.timed = settings.timed;
  if (ret.durationSeconds == null) {
    ret.durationSeconds = durationSecondsForSettings(settings);
  }
  return ret;
}

export const Invite = mongoose.model<IInvite>('Invite', inviteSchema);
