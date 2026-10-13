import mongoose, { Schema, Document } from 'mongoose';
import { REWARD_SPIN_WHEEL_FACE } from '../constants/rewardSpins';

export enum RewardSpinStatus {
  PENDING = 'pending',
  CLAIMED = 'claimed',
  DISCARDED = 'discarded',
}

export interface IRewardSpin extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  sliceIndex: number;
  status: RewardSpinStatus;
  expiresAt: Date;
  claimedAt?: Date | null;
  discardedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const rewardSpinSchema = new Schema<IRewardSpin>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      enum: [...REWARD_SPIN_WHEEL_FACE],
    },
    sliceIndex: {
      type: Number,
      required: true,
      min: 0,
      max: REWARD_SPIN_WHEEL_FACE.length - 1,
    },
    status: {
      type: String,
      enum: Object.values(RewardSpinStatus),
      default: RewardSpinStatus.PENDING,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    discardedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

rewardSpinSchema.index({ userId: 1, createdAt: -1 });
rewardSpinSchema.index(
  { userId: 1, status: 1 },
  { partialFilterExpression: { status: RewardSpinStatus.PENDING } }
);

export const RewardSpin = mongoose.model<IRewardSpin>('RewardSpin', rewardSpinSchema);
