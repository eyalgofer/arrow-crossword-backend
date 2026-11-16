import mongoose, { Schema } from 'mongoose';

/**
 * Remembered ETag for a play-tab response.
 * A matching If-None-Match can answer before the catalog or progress queries.
 */
const playTabStampSchema = new Schema(
  {
    _id: { type: String, required: true },
    etag: { type: String },
    /** Catalog generation this progress stamp was built against. */
    generation: { type: Number },
  },
  { timestamps: false }
);

export const PlayTabStamp = mongoose.model('PlayTabStamp', playTabStampSchema);
