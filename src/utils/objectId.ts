import mongoose from 'mongoose';

/**
 * Resolve a stored id without following an ObjectId's `_id` getter.
 * That getter returns the id itself, so an unguarded walk overflows the stack.
 */
export function toObjectId(id: unknown): mongoose.Types.ObjectId | null {
  if (id == null) {
    return null;
  }
  if (id instanceof mongoose.Types.ObjectId) {
    return id;
  }
  if (typeof id === 'object' && id !== null && '_id' in id) {
    const inner = (id as { _id: unknown })._id;
    if (inner != null && inner !== id) {
      return toObjectId(inner);
    }
  }
  const asString = String(id);
  if (mongoose.Types.ObjectId.isValid(asString)) {
    return new mongoose.Types.ObjectId(asString);
  }
  return null;
}

export function toIdString(id: unknown): string | null {
  const objectId = toObjectId(id);
  return objectId ? objectId.toString() : null;
}
