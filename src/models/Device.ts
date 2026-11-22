import mongoose, { Schema } from 'mongoose';
import { DevicePlatform } from './User';

export interface IDevice {
  userId: mongoose.Types.ObjectId;
  deviceId: string;
  platform: DevicePlatform | null;
  appVersion?: string | null;
  osVersion?: string | null;
  model?: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

const deviceSchema = new Schema<IDevice>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deviceId: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    enum: ['ios', 'android'],
    default: null
  },
  appVersion: {
    type: String,
    default: null,
    maxlength: 64
  },
  osVersion: {
    type: String,
    default: null,
    maxlength: 64
  },
  model: {
    type: String,
    default: null,
    maxlength: 64
  },
  firstSeenAt: {
    type: Date,
    required: true
  },
  lastSeenAt: {
    type: Date,
    required: true
  }
});

deviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
deviceSchema.index({ userId: 1, lastSeenAt: -1 });

export const Device = mongoose.model<IDevice>('Device', deviceSchema);
