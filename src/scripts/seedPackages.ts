import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Puzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { Difficulty, Language } from '../types';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError, filterValidPuzzles } from './utils/scriptUtils';
import { mixSizes } from './utils/gridSizes';

dotenv.config();

// Usage: ts-node src/scripts/seedPackages.ts [--lang he]
const langArgIndex = process.argv.indexOf('--lang');
const language: Language = langArgIndex !== -1 && process.argv[langArgIndex + 1] === 'he' ? 'he' : 'en';

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

// Package definitions per language. Hebrew users see Hebrew package
// names, descriptions, and themes.
const packageDefinitionsByLanguage: Record<Language, Array<{
  name: string;
  description: string;
  theme: string;
  puzzleCount: number;
}>> = {
  en: [
    {
      name: 'Geek Savant Collection 1',
      description: 'Lets get started!',
      theme: 'Mixed',
      puzzleCount: 10,
    },
    {
      name: 'Geek Savant Collection 2',
      description: '20 puzzles to solve',
      theme: 'Mixed',
      puzzleCount: 20,
    },
  ],
  he: [
    {
      name: 'אוסף תשבצים 1',
      description: 'בואו נתחיל!',
      theme: 'מעורב',
      puzzleCount: 10,
    },
    {
      name: 'אוסף תשבצים 2',
      description: '20 תשבצים לפתרון',
      theme: 'מעורב',
      puzzleCount: 20,
    },
  ],
};

const MISC_CATEGORY = language === 'he' ? 'כללי' : 'Misc';
const puzzleTitle = (index: number) => language === 'he' ? `תשבץ #${index}` : `Puzzle #${index}`;

const packageDefinitions = packageDefinitionsByLanguage[language].map((def, index) => ({
  ...def,
  iconName: iconNames[index % iconNames.length],
  gradientColors: gradientPalette[index % gradientPalette.length],
}));

function getDifficultyDistribution(puzzleCount: number): Array<{ difficulty: Difficulty; count: number }> {
  const easy = Math.round(puzzleCount * 0.6);
  const medium = Math.round(puzzleCount * 0.4);
  
  const distribution = [
    { difficulty: Difficulty.EASY, count: easy },
    { difficulty: Difficulty.MEDIUM, count: medium },
  ];
  
  // Adjust for rounding errors
  const total = easy + medium;
  const diff = puzzleCount - total;
  if (diff !== 0) {
    distribution[0].count += diff;
  }
  
  return distribution.filter(d => d.count > 0);
}

const seedPackages = async () => {
  try {
    await connectToDatabase();
    console.log(`📦 Creating ${packageDefinitions.length} packages (${language}) with difficulty distribution...\n`);

    let globalPuzzleIndex = 1;
    
    for (let i = 0; i < packageDefinitions.length; i++) {
      const def = packageDefinitions[i];
      const existing = await PuzzlePackage.findOne({ name: def.name, language });
      if (existing) {
        console.log(`\n📦 Skipping ${def.name} — already exists (${existing.puzzleCount} puzzles)`);
        continue;
      }
      const difficultyDistribution = getDifficultyDistribution(def.puzzleCount);
      
      console.log(`\n📦 Creating ${def.name} (${def.puzzleCount} puzzles)...`);
      
      const generatedPuzzles: any[] = [];
      const packageSizes = language === 'he' ? mixSizes(def.puzzleCount) : undefined;
      let sizeOffset = 0;
      
      // Generate puzzles for this package
      for (const { difficulty, count } of difficultyDistribution) {
        if (count === 0) continue;
        console.log(`   Generating ${count} ${difficulty} puzzle(s)...`);
        const sizes = packageSizes?.slice(sizeOffset, sizeOffset + count);
        sizeOffset += count;
        const batch = generatePuzzlesBatch({
          difficulty,
          count,
          category: MISC_CATEGORY,
          startIndex: globalPuzzleIndex,
          rows: 8,
          cols: 8,
          sizes,
          language,
        });
        const validPuzzles = filterValidPuzzles(batch, validatePuzzleBoundaries);
        generatedPuzzles.push(...validPuzzles);
        globalPuzzleIndex += validPuzzles.length;
        
        if (validPuzzles.length < count) {
          console.log(`   ⚠️  Got ${validPuzzles.length}/${count} valid ${difficulty} puzzles`);
        }
      }
      
      if (generatedPuzzles.length === 0) {
        console.log(`   ⚠️  No valid puzzles generated for ${def.name}, skipping...`);
        continue;
      }
      
      // Save puzzles to database
      const savedPuzzles = await Puzzle.insertMany(generatedPuzzles);
      const puzzleIds = savedPuzzles.map(p => p._id as mongoose.Types.ObjectId);
      
      // Show difficulty breakdown
      const difficultyBreakdown = difficultyDistribution
        .map(d => `${d.count} ${d.difficulty}`)
        .join(', ');
      console.log(`   ✅ Generated ${generatedPuzzles.length}/${def.puzzleCount} puzzles (${difficultyBreakdown})`);

      // Create package
      const newPackage = new PuzzlePackage({
        name: def.name,
        description: def.description,
        theme: def.theme,
        language,
        puzzleCount: puzzleIds.length,
        puzzleIds,
        order: i,
        iconName: def.iconName,
        gradientColors: def.gradientColors
      });
      await newPackage.save();
      
      // Update puzzles with packageId and renumber titles
      await Promise.all(puzzleIds.map((id, j) =>
        Puzzle.updateOne(
          { _id: id },
          { $set: { packageId: newPackage._id, title: puzzleTitle(j + 1) } }
        )
      ));
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📦 Package Summary:');
    console.log('='.repeat(60));
    
    const allPackages = await PuzzlePackage.find({ language }).sort({ order: 1 }).lean();
    const totalPuzzleSlots = allPackages.reduce((sum, pkg) => sum + pkg.puzzleCount, 0);
    
    for (const pkg of allPackages) {
      const puzzles = await Puzzle.find({ packageId: pkg._id }).lean();
      const difficultyCounts = puzzles.reduce((acc, p) => {
        const diff = p.difficulty || 'unknown';
        acc[diff] = (acc[diff] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const difficultyStr = Object.entries(difficultyCounts)
        .map(([diff, count]) => `${count} ${diff}`)
        .join(', ');
      
      console.log(`   ${pkg.order}. ${pkg.name.padEnd(20)} | ${String(pkg.puzzleCount).padStart(2)} puzzles | ${difficultyStr}`);
    }
    
    console.log('='.repeat(60));
    console.log(`   Total packages: ${allPackages.length}`);
    console.log(`   Total puzzles in packages: ${totalPuzzleSlots}`);
    console.log('='.repeat(60));

    console.log('\n✅ Package seeding completed successfully!');
    await closeDatabaseAndExit(0);
  } catch (error) {
    await handleScriptError(error);
  }
};

seedPackages();
