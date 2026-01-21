import { DailyPuzzle, IDailyPuzzle } from '../models/DailyPuzzle';
import { Puzzle } from '../models/Puzzle';
import mongoose from 'mongoose';

/**
 * Get day of year (1-365/366) from a date
 */
export function getDayOfYear(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Normalize a date to start of day (midnight) in local timezone
 */
function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Assign a puzzle to a specific date
 */
export async function assignPuzzleToDate(
  puzzleId: mongoose.Types.ObjectId | string,
  date: Date
): Promise<IDailyPuzzle> {
  // Normalize date to start of day
  const normalizedDate = normalizeDate(date);
  const year = normalizedDate.getFullYear();
  const dayOfYear = getDayOfYear(normalizedDate);

  // Check if puzzle exists
  const puzzle = await Puzzle.findById(puzzleId);
  if (!puzzle) {
    throw new Error(`Puzzle with ID ${puzzleId} not found`);
  }

  // Check if this date already has a puzzle assigned (using dayOfYear and year for reliable lookup)
  const existing = await DailyPuzzle.findOne({ dayOfYear, year });
  if (existing) {
    // Update existing assignment
    existing.puzzleId = puzzle._id;
    existing.date = normalizedDate;
    await existing.save();
    return existing;
  }

  // Create new assignment
  const dailyPuzzle = new DailyPuzzle({
    puzzleId: puzzle._id,
    dayOfYear,
    year,
    date: normalizedDate
  });

  await dailyPuzzle.save();
  return dailyPuzzle;
}

/**
 * Assign puzzles to multiple days (useful for bulk assignment)
 */
export async function assignPuzzlesToDateRange(
  puzzleIds: (mongoose.Types.ObjectId | string)[],
  startDate: Date,
  endDate?: Date
): Promise<IDailyPuzzle[]> {
  const assignments: IDailyPuzzle[] = [];
  const currentDate = new Date(startDate);
  const finalDate = endDate || new Date(currentDate.getTime() + (puzzleIds.length - 1) * 24 * 60 * 60 * 1000);

  let puzzleIndex = 0;

  while (currentDate <= finalDate && puzzleIndex < puzzleIds.length) {
    try {
      const assignment = await assignPuzzleToDate(puzzleIds[puzzleIndex], new Date(currentDate));
      assignments.push(assignment);
      puzzleIndex++;
    } catch (error) {
      console.error(`Failed to assign puzzle to ${currentDate.toISOString()}:`, error);
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return assignments;
}

/**
 * Get the puzzle assigned to a specific date
 */
export async function getPuzzleForDate(date: Date) {
  const year = date.getFullYear();
  const dayOfYear = getDayOfYear(date);

  const dailyPuzzle = await DailyPuzzle.findOne({ dayOfYear, year })
    .populate('puzzleId');

  return dailyPuzzle;
}
