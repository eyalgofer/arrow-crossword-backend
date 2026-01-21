import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { generatePuzzle } from './generators/puzzlesGenerator';
import { Difficulty } from '../types';
import { getAnswerCells, getNextCellAfterAnswer } from './generators/direction-utils';

dotenv.config();

// ---------------------------------------------------------------------------
// Validation: ensure every answer run terminates correctly
//
// Rule: For each clue, the cell immediately AFTER the final answer letter
// must be either:
//   - outside the grid (boundary), OR
//   - a clue cell, OR
//   - an explicit blocked cell (if provided by puzzle.grid.blockedCells).
//
// This prevents "dangling" answer cells where a word visually continues into
// an empty/playable cell.
// ---------------------------------------------------------------------------
function validatePuzzleBoundaries(puzzle: any): string[] {
  const rows: number = puzzle.grid?.rows;
  const cols: number = puzzle.grid?.cols;
  const clues: any[] = puzzle.clues || [];
  const blockedCellsInput: Array<{ row: number; col: number }> = puzzle.grid?.blockedCells || [];

  const clueCellPositions = new Set<string>();
  for (const clue of clues) {
    clueCellPositions.add(`${clue.startRow},${clue.startCol}`);
  }

  const blockedCellPositions = new Set<string>();
  for (const bc of blockedCellsInput) {
    blockedCellPositions.add(`${bc.row},${bc.col}`);
  }

  const answerCellPositions = new Set<string>();
  for (const clue of clues) {
    const cells = getAnswerCells(clue);
    for (const cell of cells) {
      answerCellPositions.add(`${cell.row},${cell.col}`);
    }
  }

  // Compute blocked cells: cells that are neither clue nor answer
  const computedBlockedCells = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      if (!clueCellPositions.has(key) && !answerCellPositions.has(key)) {
        computedBlockedCells.add(key);
      }
    }
  }

  const errors: string[] = [];
  const inBounds = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols;

  for (const clue of clues) {
    const answerCells = getAnswerCells(clue);
    if (answerCells.length === 0) continue;

    const lastCell = answerCells[answerCells.length - 1];
    const nextCellAfter = getNextCellAfterAnswer(clue.direction, lastCell, rows, cols);

    if (nextCellAfter === null) {
      // Out of bounds - valid!
      continue;
    }

    const nextCellKey = `${nextCellAfter.row},${nextCellAfter.col}`;

    // CRITICAL: The cell after the last answer letter must NOT be an answer cell
    if (answerCellPositions.has(nextCellKey)) {
      // Find which clue(s) use this cell
      const conflictingClues: number[] = [];
      for (const otherClue of clues) {
        if (otherClue.number === clue.number) continue;
        const otherCells = getAnswerCells(otherClue);
        for (const cell of otherCells) {
          if (cell.row === nextCellAfter.row && cell.col === nextCellAfter.col) {
            conflictingClues.push(otherClue.number);
            break;
          }
        }
      }
      errors.push(
        `Clue #${clue.number} "${clue.clue}" (${clue.direction}, answer="${clue.answer}"): cell after last answer letter (${nextCellAfter.row},${nextCellAfter.col}) is an answer cell from clue(s) ${conflictingClues.join(', ')}. Last answer cell: (${lastCell.row},${lastCell.col})`
      );
      continue;
    }

    // Must be either a clue cell or blocked cell
    if (!clueCellPositions.has(nextCellKey) && !blockedCellPositions.has(nextCellKey) && !computedBlockedCells.has(nextCellKey)) {
      errors.push(
        `Clue #${clue.number} "${clue.clue}" (${clue.direction}, answer="${clue.answer}"): cell after last answer letter (${nextCellAfter.row},${nextCellAfter.col}) is not clue/block/boundary. Last answer cell: (${lastCell.row},${lastCell.col})`
      );
    }
  }

  return errors;
}

// Gradient colors for packages
const gradientPalette = [
  ['#10B981', '#059669'], // Green
  ['#8B5CF6', '#7C3AED'], // Purple
  ['#F59E0B', '#D97706'], // Amber
  ['#EC4899', '#DB2777'], // Pink
  ['#14B8A6', '#0D9488'], // Teal
  ['#3B82F6', '#2563EB'], // Blue
  ['#EF4444', '#DC2626'], // Red
  ['#F97316', '#EA580C'], // Orange
  ['#A78BFA', '#8B5CF6'], // Violet
  ['#06B6D4', '#0891B2'], // Cyan
];

// Icon names for packages
const iconNames = [
  'leaf', 'text.book.closed', 'star', 'pawprint', 'globe',
  'flask', 'sportscourt', 'music.note', 'clock', 'film'
];

// Package definitions - 2 packages with 10 puzzles each
// Total puzzles needed: 10 + 10 = 20
const packageDefinitions = Array.from({ length: 2 }, (_, i) => {
  const puzzleCount = 10;
  
  return {
    name: `Package #${i + 1}`,
    description: '10 puzzles to solve',
    theme: 'Mixed',
    puzzleCount,
    iconName: iconNames[i],
    gradientColors: gradientPalette[i]
  };
});

// Calculate total puzzles needed
const TOTAL_PUZZLES_NEEDED = packageDefinitions.reduce((sum, pkg) => sum + pkg.puzzleCount, 0);

const seedPackages = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arrow-crossword';

    console.log('\n🔍 Connection Details:');
    console.log(`   MONGODB_URI from env: ${process.env.MONGODB_URI ? 'SET' : 'NOT SET'}`);

    // Ensure the database name is 'arrow-crossword' in the connection string
    if (mongoUri.includes('mongodb+srv://') || mongoUri.includes('mongodb://')) {
      const uriParts = mongoUri.split('/');
      const lastPart = uriParts[uriParts.length - 1];

      if (lastPart.includes('?')) {
        const [dbName, options] = lastPart.split('?');
        if (!dbName || dbName === 'test') {
          uriParts[uriParts.length - 1] = `arrow-crossword?${options}`;
          mongoUri = uriParts.join('/');
        }
      } else {
        if (!lastPart || lastPart === 'test') {
          mongoUri = mongoUri.endsWith('/') ? `${mongoUri}arrow-crossword` : `${mongoUri}/arrow-crossword`;
        }
      }
    }

    console.log(`   Using URI: ${mongoUri.substring(0, 50)}...`);

    await mongoose.connect(mongoUri);

    const dbName = mongoose.connection.db?.databaseName;
    const host = mongoose.connection.host;

    console.log(`✅ Connected to MongoDB`);
    console.log(`   Host: ${host}`);
    console.log(`   Database: ${dbName}`);
    console.log('');

    // Check existing puzzles
    const existingPuzzles = await Puzzle.find({ isActive: { $ne: false } })
      .sort({ createdAt: 1 })
      .lean();

    console.log(`📊 Found ${existingPuzzles.length} existing puzzles in database`);
    console.log(`📊 Need ${TOTAL_PUZZLES_NEEDED} puzzles for ${packageDefinitions.length} packages`);

    // Check if existing puzzles have small grids (7x7) - if so, regenerate all
    const smallGridPuzzles = existingPuzzles.filter(p => p.grid.rows < 10 || p.grid.cols < 10);
    const forceRegenerate = smallGridPuzzles.length > 0;
    
    // FORCE REGENERATION: Clear all puzzles to regenerate with new fixes
    // This ensures all puzzles are regenerated with the latest fixes for word endings and clue cells
    let clearedPuzzles = false;
    if (existingPuzzles.length > 0) {
      await Puzzle.deleteMany({});
      await PuzzlePackage.deleteMany({});
      console.log(`✅ Cleared ${existingPuzzles.length} puzzles and all packages`);
      clearedPuzzles = true;
    }

    // Generate puzzles if we don't have enough (or if we cleared them)
    // If we cleared puzzles, currentCount is 0. Otherwise, use existing count.
    const currentCount = clearedPuzzles ? 0 : existingPuzzles.length;
    const puzzlesToGenerate = Math.max(0, TOTAL_PUZZLES_NEEDED - currentCount);
    
    if (puzzlesToGenerate > 0) {
      console.log(`\n🎯 Generating ${puzzlesToGenerate} new puzzles with 11x11+ grids (using only easy/medium/challenging clues)...`);
      console.log('='.repeat(60));
      
      const generatedPuzzles: any[] = [];
      const startTime = Date.now();
      
      for (let i = 0; i < puzzlesToGenerate; i++) {
        const puzzleIndex = generatedPuzzles.length + 1;
        console.log(`\n📝 Generating puzzle ${i + 1}/${puzzlesToGenerate} (Index ${puzzleIndex})...`);
        
        const puzzle = generatePuzzle({
          difficulty: Difficulty.EASY,
          category: 'Misc',
          title: `Puzzle ${puzzleIndex}`
        });
        
        if (puzzle) {
          // Validate the generated puzzle
          const boundaryErrors = validatePuzzleBoundaries(puzzle);
          if (boundaryErrors.length > 0) {
            console.log(`❌ Generated puzzle failed boundary validation (${boundaryErrors.length} errors). Retrying...`);
            for (const err of boundaryErrors.slice(0, 5)) {
              console.log(`   └─ ${err}`);
            }
            i--; // Retry this index
            continue;
          }

          generatedPuzzles.push(puzzle);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`✅ Generated + validated! (${generatedPuzzles.length}/${puzzlesToGenerate}, ${elapsed}s elapsed)`);
        } else {
          console.log(`❌ Failed to generate, retrying...`);
          i--; // Retry
        }
      }
      
      // Save generated puzzles to database
      if (generatedPuzzles.length > 0) {
        await Puzzle.insertMany(generatedPuzzles);
        console.log(`\n📥 Saved ${generatedPuzzles.length} new puzzles to database`);
      }
    }

    // Reload all puzzles after generation
    const allPuzzles = await Puzzle.find({ isActive: { $ne: false } })
      .sort({ createdAt: 1 })
      .lean();

    console.log(`\n📊 Total puzzles available: ${allPuzzles.length}`);

    if (allPuzzles.length < TOTAL_PUZZLES_NEEDED) {
      console.error(`❌ Not enough puzzles. Have ${allPuzzles.length}, need ${TOTAL_PUZZLES_NEEDED}`);
      await mongoose.connection.close();
      process.exit(1);
    }

    // Clear existing packages
    await PuzzlePackage.deleteMany({});
    console.log('\n🗑️  Cleared existing packages');

    // Clear packageId from all puzzles
    await Puzzle.updateMany({}, { $unset: { packageId: 1 } });
    console.log('🗑️  Cleared packageId from all puzzles\n');

    // Create all packages
    console.log(`📦 Creating ${packageDefinitions.length} packages...\n`);

    let puzzleIndex = 0;
    for (let i = 0; i < packageDefinitions.length; i++) {
      const def = packageDefinitions[i];
      
      // Select sequential puzzles for this package (no overlap)
      const puzzleIds: mongoose.Types.ObjectId[] = [];
      const puzzlesForPackage: any[] = [];
      for (let j = 0; j < def.puzzleCount; j++) {
        puzzleIds.push(allPuzzles[puzzleIndex]._id as mongoose.Types.ObjectId);
        puzzlesForPackage.push(allPuzzles[puzzleIndex]);
        puzzleIndex++;
      }

      const newPackage = new PuzzlePackage({
        name: def.name,
        description: def.description,
        theme: def.theme,
        puzzleCount: def.puzzleCount,
        puzzleIds: puzzleIds,
        order: i,
        iconName: def.iconName,
        gradientColors: def.gradientColors
      });

      await newPackage.save();
      
      // Update puzzles with packageId and renumber titles within package (starting from #1)
      for (let j = 0; j < puzzleIds.length; j++) {
        await Puzzle.updateOne(
          { _id: puzzleIds[j] },
          { 
            $set: { 
              packageId: newPackage._id,
              title: `Puzzle #${j + 1}` // Number within package: #1, #2, #3...
            } 
          }
        );
      }
      
      console.log(`   ✅ ${i + 1}. ${def.name} (${def.puzzleCount} puzzles) - ${def.theme}`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📦 Package Summary:');
    console.log('='.repeat(60));
    
    const allPackages = await PuzzlePackage.find().sort({ order: 1 }).lean();
    
    let totalPuzzleSlots = 0;
    for (const pkg of allPackages) {
      totalPuzzleSlots += pkg.puzzleCount;
      console.log(`   ${pkg.order}. ${pkg.name.padEnd(20)} | ${String(pkg.puzzleCount).padStart(2)} puzzles | ${pkg.theme}`);
    }
    
    console.log('='.repeat(60));
    console.log(`   Total packages: ${allPackages.length}`);
    console.log(`   Total puzzles in packages: ${totalPuzzleSlots}`);
    console.log(`   Pattern: 10, 10`);
    console.log(`   All clues: easy/medium/challenging only (no hard/expert)`);
    console.log('='.repeat(60));

    console.log('\n✅ Package seeding completed successfully!');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

seedPackages();
