import mongoose, { Document, Schema } from 'mongoose';

export type HoldStatus = 'searching' | 'matched' | 'refunded';
export type HoldBoostStatus = 'pending' | 'claimed';

export interface IHoldBoost {
  boostId: string;
  amount: number;
  status: HoldBoostStatus;
}

export interface IMatchmakingHold extends Document {
  userId: mongoose.Types.ObjectId;
  firebaseUid: string;
  stake: number;
  status: HoldStatus;
  boost?: IHoldBoost | null;
  /** Balance immediately after the stake was escrowed. */
  coins: number;
  createdAt: Date;
  updatedAt: Date;
}

const holdSchema = new Schema<IMatchmakingHold>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  firebaseUid: {
    type: String,
    required: true,
    index: true
  },
  stake: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['searching', 'matched', 'refunded'],
    required: true,
    index: true
  },
  boost: {
    type: new Schema<IHoldBoost>({
      boostId: { type: String, required: true },
      amount: { type: Number, required: true },
      status: { type: String, enum: ['pending', 'claimed'], required: true }
    }, { _id: false }),
    default: null
  },
  coins: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

holdSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: 'searching' } }
);

export const MatchmakingHold = mongoose.model<IMatchmakingHold>('MatchmakingHold', holdSchema);
