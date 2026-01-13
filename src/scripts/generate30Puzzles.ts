import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { generateOnePerfectPuzzle } from './generators/puzzlesGenerator';
import { Difficulty } from '../types';
import { Puzzle } from '../models/Puzzle';

dotenv.config();

/**
 * Generate 30 puzzles and save them to MongoDB
 */
async function generate30Puzzles() {
  try {
    console.log('🚀 Starting generation of 30 puzzles for MongoDB...\n');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable is not set');
      process.exit(1);
    }
    
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const dbName = mongoose.connection.db?.databaseName;
    const host = mongoose.connection.host;
    const collectionName = Puzzle.collection.name;
    
    console.log(`✅ Connected to MongoDB`);
    console.log(`   Host: ${host}`);
    console.log(`   Database: ${dbName}`);
    console.log(`   Collection: ${collectionName}`);
    console.log('');
    
    // Check current puzzle count
    const countBefore = await Puzzle.countDocuments({});
    console.log(`📊 Current puzzles in database: ${countBefore}\n`);
    
    const puzzles: any[] = [];
    const startTime = Date.now();
    
    for (let i = 1; i <= 30; i++) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Generating Puzzle ${i}/30`);
      console.log('='.repeat(60));
      
      const puzzle = generateOnePerfectPuzzle({
        difficulty: Difficulty.MEDIUM,
        category: 'Daily Life',
        title: `Generated Puzzle ${i}`
      });
      
      if (puzzle) {
        puzzles.push(puzzle);
        console.log(`✅ Puzzle ${i} generated successfully!`);
      } else {
        console.log(`❌ Puzzle ${i} failed to generate`);
      }
    }
    
    if (puzzles.length === 0) {
      console.error('\n❌ No puzzles were generated!');
      await mongoose.connection.close();
      process.exit(1);
    }
    
    // Save all puzzles to MongoDB
    console.log(`\n${'='.repeat(60)}`);
    console.log(`💾 Saving ${puzzles.length} puzzles to MongoDB...`);
    console.log('='.repeat(60));
    
    await Puzzle.insertMany(puzzles);
    console.log(`✅ Successfully saved ${puzzles.length} puzzles to MongoDB!`);
    
    // Verify final count
    const countAfter = await Puzzle.countDocuments({});
    console.log(`📊 Total puzzles in database: ${countAfter}`);
    
    const elapsed = Date.now() - startTime;
    const elapsedMinutes = (elapsed / 1000 / 60).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 GENERATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total puzzles generated: ${puzzles.length}/30`);
    console.log(`Success rate: ${((puzzles.length / 30) * 100).toFixed(1)}%`);
    console.log(`Total time: ${elapsedMinutes} minutes`);
    if (puzzles.length > 0) {
      console.log(`Average time per puzzle: ${(elapsed / puzzles.length / 1000 / 60).toFixed(1)} minutes`);
    }
    console.log(`\n✅ All puzzles saved to MongoDB!`);
    console.log(`   View them at: ${host}/${dbName}/${collectionName}`);
    
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating puzzles:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  generate30Puzzles();
}

export { generate30Puzzles };
