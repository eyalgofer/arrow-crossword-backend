import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';

dotenv.config();

// Package definitions - 12 packages with pattern: 10, 10, 20, 10, 10, 20...
const packageDefinitions = [
  // Group 1: 10, 10, 20
  {
    name: 'Getting Started',
    description: 'Perfect for beginners - learn the ropes!',
    theme: 'Basics',
    puzzleCount: 10,
    iconName: 'leaf',
    gradientColors: ['#10B981', '#059669'] // Green
  },
  {
    name: 'Word Play',
    description: 'Fun with words and language',
    theme: 'Language',
    puzzleCount: 10,
    iconName: 'text.book.closed',
    gradientColors: ['#8B5CF6', '#7C3AED'] // Purple
  },
  {
    name: 'Big Challenge',
    description: 'Ready for something bigger? 20 puzzles await!',
    theme: 'Mixed',
    puzzleCount: 20,
    iconName: 'star',
    gradientColors: ['#F59E0B', '#D97706'] // Amber
  },
  // Group 2: 10, 10, 20
  {
    name: 'Animal Kingdom',
    description: 'Explore the wild world of animals',
    theme: 'Animals',
    puzzleCount: 10,
    iconName: 'pawprint',
    gradientColors: ['#EC4899', '#DB2777'] // Pink
  },
  {
    name: 'World Explorer',
    description: 'Travel the globe with geography puzzles',
    theme: 'Geography',
    puzzleCount: 10,
    iconName: 'globe',
    gradientColors: ['#14B8A6', '#0D9488'] // Teal
  },
  {
    name: 'Science Lab',
    description: 'Discover the wonders of science',
    theme: 'Science',
    puzzleCount: 20,
    iconName: 'flask',
    gradientColors: ['#3B82F6', '#2563EB'] // Blue
  },
  // Group 3: 10, 10, 20
  {
    name: 'Sports Fan',
    description: 'For the love of the game',
    theme: 'Sports',
    puzzleCount: 10,
    iconName: 'sportscourt',
    gradientColors: ['#EF4444', '#DC2626'] // Red
  },
  {
    name: 'Music Maestro',
    description: 'Feel the rhythm and melody',
    theme: 'Music',
    puzzleCount: 10,
    iconName: 'music.note',
    gradientColors: ['#F97316', '#EA580C'] // Orange
  },
  {
    name: 'History Buff',
    description: 'Journey through time and history',
    theme: 'History',
    puzzleCount: 20,
    iconName: 'clock',
    gradientColors: ['#A78BFA', '#8B5CF6'] // Violet
  },
  // Group 4: 10, 10, 20
  {
    name: 'Pop Culture',
    description: 'Movies, TV, and entertainment',
    theme: 'Entertainment',
    puzzleCount: 10,
    iconName: 'film',
    gradientColors: ['#06B6D4', '#0891B2'] // Cyan
  },
  {
    name: 'Food & Drink',
    description: 'A feast for puzzle lovers',
    theme: 'Food',
    puzzleCount: 10,
    iconName: 'fork.knife',
    gradientColors: ['#84CC16', '#65A30D'] // Lime
  },
  {
    name: 'Master Collection',
    description: 'The ultimate challenge for puzzle masters',
    theme: 'Expert',
    puzzleCount: 20,
    iconName: 'crown',
    gradientColors: ['#FBBF24', '#F59E0B'] // Yellow/Gold
  }
];

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

    // Get all available puzzles
    const allPuzzles = await Puzzle.find({ isActive: { $ne: false } })
      .sort({ createdAt: 1 })
      .lean();

    console.log(`📊 Found ${allPuzzles.length} total puzzles in database`);

    if (allPuzzles.length === 0) {
      console.error('❌ No puzzles found in database. Please seed puzzles first.');
      await mongoose.connection.close();
      process.exit(1);
    }

    // Clear existing packages
    await PuzzlePackage.deleteMany({});
    console.log('🗑️  Cleared existing packages');

    // Clear packageId from all puzzles
    await Puzzle.updateMany({}, { $unset: { packageId: 1 } });
    console.log('🗑️  Cleared packageId from all puzzles\n');

    // Create all packages
    console.log('📦 Creating 12 packages...\n');

    for (let i = 0; i < packageDefinitions.length; i++) {
      const def = packageDefinitions[i];
      
      // Select puzzles for this package (cycling through available puzzles)
      const puzzleIds: mongoose.Types.ObjectId[] = [];
      for (let j = 0; j < def.puzzleCount; j++) {
        const puzzleIndex = (i * 10 + j) % allPuzzles.length;
        puzzleIds.push(allPuzzles[puzzleIndex]._id as mongoose.Types.ObjectId);
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
      console.log(`   ${pkg.order}. ${pkg.name.padEnd(20)} | ${pkg.puzzleCount} puzzles | ${pkg.theme}`);
    }
    
    console.log('='.repeat(60));
    console.log(`   Total packages: ${allPackages.length}`);
    console.log(`   Total puzzle slots: ${totalPuzzleSlots}`);
    console.log(`   Unique puzzles used: ${allPuzzles.length}`);
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
