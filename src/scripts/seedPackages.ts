import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Puzzle, IPuzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { generatePuzzle } from './generators/puzzlesGenerator';
import { Difficulty } from '../types';

dotenv.config();

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
    if (existingPuzzles.length > 0) {
      console.log(`\n🔄 Regenerating all puzzles with latest fixes...`);
      console.log(`   - Fixed: Words can only end at clue cells, blocked cells, or grid boundaries`);
      console.log(`   - Fixed: Clue cells are unique (no overlapping question arrows)`);
      console.log(`🗑️  Clearing all existing puzzles...`);
      await Puzzle.deleteMany({});
      await PuzzlePackage.deleteMany({});
      console.log(`✅ Cleared ${existingPuzzles.length} puzzles and all packages`);
    }

    // Generate puzzles if we don't have enough (or if we cleared them)
    const currentCount = forceRegenerate ? 0 : existingPuzzles.length;
    const puzzlesToGenerate = Math.max(0, TOTAL_PUZZLES_NEEDED - currentCount);
    
    if (puzzlesToGenerate > 0) {
      console.log(`\n🎯 Generating ${puzzlesToGenerate} new puzzles with 11x11+ grids (using only easy/medium/challenging clues)...`);
      console.log('='.repeat(60));
      
      const generatedPuzzles: any[] = [];
      const startTime = Date.now();
      
      for (let i = 0; i < puzzlesToGenerate; i++) {
        const puzzleIndex = generatedPuzzles.length + 1;
        console.log(`\n📝 Generating puzzle ${i + 1}/${puzzlesToGenerate} (Index ${puzzleIndex})...`);
        
        // Generate puzzle with temporary title - will be updated per package later
        const puzzle = generatePuzzle({
          difficulty: Difficulty.EASY, // Uses easy/medium/challenging clues only
          category: 'Mixed',
          title: `Puzzle ${puzzleIndex}` // Temporary title, will be updated per package
        });
        
        if (puzzle) {
          generatedPuzzles.push(puzzle);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`✅ Generated! (${generatedPuzzles.length}/${puzzlesToGenerate}, ${elapsed}s elapsed)`);
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
