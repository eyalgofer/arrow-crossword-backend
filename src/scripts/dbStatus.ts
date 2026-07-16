import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { MultiplayerPuzzle } from '../models/MultiplayerPuzzle';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';

dotenv.config();

const main = async () => {
  try {
    await connectToDatabase();

    const puzzleCount = await Puzzle.countDocuments();
    const byCategory = await Puzzle.aggregate([
      { $group: { _id: { category: '$category', rows: '$grid.rows' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const packages = await PuzzlePackage.find().sort({ order: 1 }).lean();
    const dailyCount = await DailyPuzzle.countDocuments();
    const dailyFuture = await DailyPuzzle.countDocuments({ date: { $gte: new Date() } });
    const multiplayerCount = await MultiplayerPuzzle.countDocuments();

    console.log(`\nPuzzles: ${puzzleCount}`);
    for (const g of byCategory) {
      console.log(`  ${g._id.category} (${g._id.rows}x${g._id.rows}): ${g.count}`);
    }
    console.log(`\nPackages: ${packages.length}`);
    for (const p of packages) {
      console.log(`  order=${p.order} "${p.name}" puzzles=${p.puzzleIds?.length}`);
    }
    console.log(`\nDailyPuzzle assignments: ${dailyCount} (future incl. today: ${dailyFuture})`);
    console.log(`MultiplayerPuzzle assignments: ${multiplayerCount}`);

    await closeDatabaseAndExit(0);
  } catch (e) {
    await handleScriptError(e);
  }
};

main();
