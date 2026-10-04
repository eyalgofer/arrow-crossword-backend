import mongoose, { Schema, Document } from 'mongoose';

export const SUGGESTION_MAX_LENGTH = 2000;

export interface IUserIdea extends Document {
  user_id: mongoose.Types.ObjectId;
  user_name: string;
  user_email: string;
  suggestion: string;
  createdAt: Date;
  updatedAt: Date;
}

const userIdeaSchema = new Schema<IUserIdea>({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  user_name: {
    type: String,
    default: ''
  },
  user_email: {
    type: String,
    required: true
  },
  suggestion: {
    type: String,
    required: true,
    maxlength: SUGGESTION_MAX_LENGTH
  }
}, {
  timestamps: true,
  collection: 'users_ideas'
});

export const UserIdea = mongoose.model<IUserIdea>('UserIdea', userIdeaSchema);
