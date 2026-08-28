import mongoose, { Schema, Document } from 'mongoose';

export interface IRefreshToken extends Document {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);
