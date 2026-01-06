import mongoose, { Schema, Document } from 'mongoose';

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
  respondedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
inviteSchema.index({ to: 1, status: 1 });
inviteSchema.index({ from: 1, to: 1 }, { unique: true });

export const Invite = mongoose.model<IInvite>('Invite', inviteSchema);
