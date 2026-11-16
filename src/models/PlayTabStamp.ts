import mongoose, { Schema } from 'mongoose';

/**
 * Epochs and remembered ETags for play-tab responses.
 * A matching If-None-Match can answer before the catalog or card queries.
 * Epoch bumps clear the etags they own in the same write.
 */
const playTabStampSchema = new Schema(
  {
    _id: { type: String, required: true },
    generation: { type: Number },
    catalogGeneration: { type: Number },
    catalog: { type: Number },
    daily: { type: Number },
    community: { type: Number },
    picks: { type: Number },
    etags: { type: Schema.Types.Mixed },
    catalogEtags: { type: Schema.Types.Mixed },
    solvedEtags: { type: Schema.Types.Mixed },
    cards: { type: Schema.Types.Mixed },
  },
  { timestamps: false }
);

export const PlayTabStamp = mongoose.model('PlayTabStamp', playTabStampSchema);
