import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import { assignPuzzleToDate } from '../utils/dailyPuzzleUtils';
import { closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';

dotenv.config();

const assignSingleDaily = async () => {
  try {
    await connectDatabase();

    const puzzleId = '697920dff7b3433dd7b17255';
    const today = new Date();

    const assignment = await assignPuzzleToDate(puzzleId, today);

    console.log(`✅ Puzzle ${puzzleId} assigned to today (${today.toLocaleDateString()})`);
    console.log('   Assignment:', assignment);

    await closeDatabaseAndExit(0);
  } catch (error) {
    await handleScriptError(error);
  }
};

assignSingleDaily();
