import mongoose, { Schema, Document } from 'mongoose';

/**
 * One row per claimed clue. Unique (matchId, clueId) makes the first write win
 * when two players claim the same word at the same time.
 */
export interface IMatchWordClaim extends Document {
  matchId: mongoose.Types.ObjectId;
  clueId: string;
  answer: string;
  userId: mongoose.Types.ObjectId;
  displayName: string;
  claimedAt: Date;
}

const matchWordClaimSchema = new Schema<IMatchWordClaim>({
  matchId: {
    type: Schema.Types.ObjectId,
    ref: 'Match',
    required: true
  },
  clueId: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  claimedAt: {
    type: Date,
    default: Date.now
  }
});

matchWordClaimSchema.index({ matchId: 1, clueId: 1 }, { unique: true });
matchWordClaimSchema.index({ matchId: 1 });

export const MatchWordClaim = mongoose.model<IMatchWordClaim>('MatchWordClaim', matchWordClaimSchema);
