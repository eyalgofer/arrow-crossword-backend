import mongoose from 'mongoose';
import { MultiplayerPuzzle } from '../models/MultiplayerPuzzle';
import { Puzzle, IPuzzle } from '../models/Puzzle';
import { Language } from '../types';
import { languageFilter } from './language';

export async function pickMultiplayerPuzzle(language: Language): Promise<{
  puzzle: IPuzzle;
  puzzleId: mongoose.Types.ObjectId;
} | null> {
  const tryPool = async (lang: Language) => {
    const assignments = await MultiplayerPuzzle.find({ language: languageFilter(lang) })
      .select('puzzleId')
      .lean();
    const shuffled = [...assignments].sort(() => Math.random() - 0.5);
    for (const assignment of shuffled) {
      const found = await Puzzle.findById(assignment.puzzleId);
      if (found) {
        return { puzzle: found, puzzleId: assignment.puzzleId };
      }
    }
    return null;
  };

  const fromPool = await tryPool(language);
  if (fromPool) return fromPool;

  // No dedicated multiplayer assignment: any active puzzle in that language
  const fallback = await Puzzle.findOne({ isActive: { $ne: false }, language: languageFilter(language) })
    .sort({ createdAt: 1 });
  if (fallback) {
    return { puzzle: fallback, puzzleId: fallback._id };
  }

  if (language !== 'en') {
    return tryPool('en');
  }

  return null;
}
