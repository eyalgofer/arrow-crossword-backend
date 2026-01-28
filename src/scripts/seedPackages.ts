import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { Difficulty } from '../types';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';

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

// Package definitions - Pattern: 2 packages of 10 puzzles, then 1 package of 20 puzzles, repeated 3 times
const packageDefinitions: Array<{
  name: string;
  description: string;
  theme: string;
  puzzleCount: number;
  iconName: string;
  gradientColors: string[];
}> = [];
  
  // First package of 10 puzzles
  packageDefinitions.push({
    name: `Getting creative`,
    description: 'Lets get started!',
    theme: 'Mixed',
    puzzleCount: 10,
    iconName: iconNames[iconNames.length],
    gradientColors: gradientPalette[gradientPalette.length]
  });
  
  // // Second package of 20 puzzles
  packageDefinitions.push({
    name: `Genius level`,
    description: '20 puzzles to solve',
    theme: 'Mixed',
    puzzleCount: 10,
    iconName: iconNames[iconNames.length],
    gradientColors: gradientPalette[gradientPalette.length]
  });
  
  // // // Package of 20 puzzles
  // packageDefinitions.push({
  //   name: `Lets get creative`,
  //   description: '20 puzzles to solve',
  //   theme: 'Mixed',
  //   puzzleCount: 20,
  //   iconName: iconNames[iconNames.length],
  //   gradientColors: gradientPalette[gradientPalette.length]
  // });

  // packageDefinitions.push({
  //   name: `You might be hooked`,
  //   description: '10 puzzles to solve',
  //   theme: 'Mixed',
  //   puzzleCount: 10,
  //   iconName: iconNames[iconNames.length],
  //   gradientColors: gradientPalette[gradientPalette.length]
  // });

  // packageDefinitions.push({
  //   name: `This one is a bit harder`,
  //   description: '10 puzzles to solve',
  //   theme: 'Mixed',
  //   puzzleCount: 10,x
  //   iconName: iconNames[iconNames.length],
  //   gradientColors: gradientPalette[gradientPalette.length]
  // });

function getDifficultyDistribution(puzzleCount: number): Array<{ difficulty: Difficulty; count: number }> {
  const easy = Math.round(puzzleCount * 0.6);
  const medium = Math.round(puzzleCount * 0.4);
  const challenging = Math.round(puzzleCount * 0);
  const hard = Math.round(puzzleCount * 0);
  const expert = Math.round(puzzleCount * 0);
  
  // Adjust for rounding errors to ensure total equals puzzleCount
  const total = easy + medium + hard + challenging + expert;
  const diff = puzzleCount - total;
  
  const distribution = [
    { difficulty: Difficulty.EASY, count: easy },
    { difficulty: Difficulty.MEDIUM, count: medium },
    { difficulty: Difficulty.HARD, count: hard },
    { difficulty: Difficulty.CHALLENGING, count: challenging },
    { difficulty: Difficulty.EXPERT, count: expert }
  ];
  
  // Add any difference to easy puzzles
  if (diff !== 0) {
    distribution[0].count += diff;
  }
  
  return distribution.filter(d => d.count > 0);
}

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

    // Clear existing packages
    // await PuzzlePackage.deleteMany({});
    // console.log('\n🗑️  Cleared existing packages');

    // Clear packageId from all puzzles
    // await Puzzle.updateMany({}, { $unset: { packageId: 1 } });
    // console.log('🗑️  Cleared packageId from all puzzles\n');

    // Create all packages and generate puzzles with correct difficulty distribution
    console.log(`📦 Creating ${packageDefinitions.length} packages with difficulty distribution...\n`);

    let globalPuzzleIndex = 1;
    
    for (let i = 0; i < packageDefinitions.length; i++) {
      const def = packageDefinitions[i];
      const difficultyDistribution = getDifficultyDistribution(def.puzzleCount);
      
      console.log(`\n📦 Creating ${def.name} (${def.puzzleCount} puzzles)...`);
      
      const puzzleIds: mongoose.Types.ObjectId[] = [];
      const generatedPuzzles: any[] = [];
      
      // Generate puzzles for this package: one template per difficulty, then solve it count times
      for (const { difficulty, count } of difficultyDistribution) {
        if (count === 0) continue;
        console.log(`   Generating ${count} ${difficulty} puzzle(s) from one template...`);
        const batch = generatePuzzlesBatch({
          difficulty,
          count,
          category: 'Misc',
          startIndex: globalPuzzleIndex,
        });
        for (const puzzle of batch) {
          const boundaryErrors = validatePuzzleBoundaries(puzzle);
          if (boundaryErrors.length === 0) {
            generatedPuzzles.push(puzzle);
            globalPuzzleIndex++;
          }
        }
        if (batch.length < count) {
          console.log(`   ⚠️  Got ${batch.length}/${count} valid ${difficulty} puzzles`);
        }
      }
      
      // Save generated puzzles to database
      if (generatedPuzzles.length > 0) {
        const savedPuzzles = await Puzzle.insertMany(generatedPuzzles);
        for (const savedPuzzle of savedPuzzles) {
          puzzleIds.push(savedPuzzle._id as mongoose.Types.ObjectId);
        }
      }
      
      // Show difficulty breakdown for this package
      const difficultyBreakdown = difficultyDistribution
        .map(d => `${d.count} ${d.difficulty}`)
        .join(', ');
      console.log(`   ✅ Generated ${generatedPuzzles.length}/${def.puzzleCount} puzzles (${difficultyBreakdown})`);

      if (generatedPuzzles.length < def.puzzleCount) {
        console.log(`   ⚠️  Warning: Only generated ${generatedPuzzles.length} puzzles, expected ${def.puzzleCount}`);
      }

      const newPackage = new PuzzlePackage({
        name: def.name,
        description: def.description,
        theme: def.theme,
        puzzleCount: puzzleIds.length,
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
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📦 Package Summary:');
    console.log('='.repeat(60));
    
    const allPackages = await PuzzlePackage.find().sort({ order: 1 }).lean();
    
    let totalPuzzleSlots = 0;
    for (const pkg of allPackages) {
      totalPuzzleSlots += pkg.puzzleCount;
      
      // Get difficulty breakdown for this package
      const puzzles = await Puzzle.find({ packageId: pkg._id }).lean();
      const difficultyCounts: Record<string, number> = {};
      for (const puzzle of puzzles) {
        const diff = puzzle.difficulty || 'unknown';
        difficultyCounts[diff] = (difficultyCounts[diff] || 0) + 1;
      }
      
      const difficultyStr = Object.entries(difficultyCounts)
        .map(([diff, count]) => `${count} ${diff}`)
        .join(', ');
      
      console.log(`   ${pkg.order}. ${pkg.name.padEnd(20)} | ${String(pkg.puzzleCount).padStart(2)} puzzles | ${difficultyStr}`);
    }
    
    console.log('='.repeat(60));
    console.log(`   Total packages: ${allPackages.length}`);
    console.log(`   Total puzzles in packages: ${totalPuzzleSlots}`);
    console.log(`   Pattern: 10, 10, 20 (repeated 3 times)`);
    console.log(`   Difficulty distribution per package:`);
    console.log(`     40% easy, 30% medium, 20% hard, 10% challenging, 10% expert`);
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
