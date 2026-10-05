import mongoose, { Schema, Document } from 'mongoose';
import { MatchMode } from '../types';

export interface IGroup extends Document {
  name: string;
  ownerId: mongoose.Types.ObjectId;
  memberIds: mongoose.Types.ObjectId[];
  memberKey: string;
  lastMode?: MatchMode;
  lastTimed?: boolean;
  lastPlayedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const groupSchema = new Schema<IGroup>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  memberIds: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  memberKey: {
    type: String,
    required: true
  },
  lastMode: {
    type: String,
    enum: Object.values(MatchMode)
  },
  lastTimed: {
    type: Boolean
  },
  lastPlayedAt: {
    type: Date
  }
}, {
  timestamps: true
});

groupSchema.index({ ownerId: 1, memberKey: 1 }, { unique: true });
groupSchema.index({ ownerId: 1, lastPlayedAt: -1, updatedAt: -1 });

export const Group = mongoose.model<IGroup>('Group', groupSchema);
