import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database';

/**
 * Connect to MongoDB using the shared database utility
 */
export async function connectToDatabase(): Promise<void> {
  await connectDatabase();
}

/**
 * Close MongoDB connection and exit process
 */
export async function closeDatabaseAndExit(code: number = 0): Promise<never> {
  await mongoose.connection.close();
  process.exit(code);
}

/**
 * Handle script errors with proper cleanup
 */
export async function handleScriptError(error: unknown): Promise<never> {
  console.error('❌ Script error:', error);
  if (error instanceof Error) {
    console.error('   Message:', error.message);
  }
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
}

/**
 * Filter valid puzzles by boundary validation
 */
export function filterValidPuzzles(puzzles: any[], validateFn: (puzzle: any) => string[]): any[] {
  return puzzles.filter(puzzle => {
    const errors = validateFn(puzzle);
    if (errors.length > 0) {
      console.warn('   ⚠️  Generated puzzle failed boundary validation:', errors);
      return false;
    }
    return true;
  });
}
