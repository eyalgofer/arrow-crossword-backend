import mongoose, { Schema, Document } from 'mongoose';

export interface IImageClue extends Document {
  id: string;
  type: string;
  category: string;
  subject: string;
  answer_hebrew: string;
  aliases_hebrew: string;
  country: string;
  recognition: number;
  difficulty: number;
  israeli_relevance: number;
  global_relevance: number;
  image_source: string;
  source_url: string;
  author: string;
  license: string;
  license_url: string;
  s3_key: string;
  image_url: string;
  image_original_url: string;
  image_commons_title: string;
  image_approved_at: string;
  letter_length: number;
  active: boolean;
  notes: string;
  created_at?: Date;
  updated_at?: Date;
}

const imageClueSchema = new Schema<IImageClue>(
  {
    id: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    category: { type: String, default: '' },
    subject: { type: String, required: true },
    answer_hebrew: { type: String, required: true },
    aliases_hebrew: { type: String, default: '' },
    country: { type: String, default: '' },
    recognition: { type: Number, default: 0 },
    difficulty: { type: Number, default: 0 },
    israeli_relevance: { type: Number, default: 0 },
    global_relevance: { type: Number, default: 0 },
    image_source: { type: String, default: '' },
    source_url: { type: String, default: '' },
    author: { type: String, default: '' },
    license: { type: String, default: '' },
    license_url: { type: String, default: '' },
    s3_key: { type: String, default: '' },
    image_url: { type: String, default: '' },
    image_original_url: { type: String, default: '' },
    image_commons_title: { type: String, default: '' },
    image_approved_at: { type: String, default: '' },
    letter_length: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    notes: { type: String, default: '' },
  },
  {
    id: false,
    collection: 'image_clues',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

imageClueSchema.index({ active: 1, letter_length: 1 });
imageClueSchema.index({ answer_hebrew: 1 });

export const ImageClue = mongoose.model<IImageClue>('ImageClue', imageClueSchema);
