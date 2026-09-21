import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Puzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { Difficulty, Language } from '../types';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import {
  connectToDatabase,
  closeDatabaseAndExit,
  handleScriptError,
  filterValidPuzzles,
  clearPackagesForLanguage,
} from './utils/scriptUtils';
import { mixSizes } from './utils/gridSizes';

dotenv.config();

// Usage: ts-node src/scripts/seedPackages.ts [--lang he] [--package 1] [--force]
const langArgIndex = process.argv.indexOf('--lang');
const language: Language = langArgIndex !== -1 && process.argv[langArgIndex + 1] === 'he' ? 'he' : 'en';
const packageArgIndex = process.argv.indexOf('--package');
const packageNumber = packageArgIndex !== -1 ? parseInt(process.argv[packageArgIndex + 1], 10) : null;
const forceReplace = process.argv.includes('--force');

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
  puzzleMix?: Array<{ difficulty: Difficulty; count: number }>;
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
      name: 'אוסף תשחצים 1',
      description: 'בואו נתחיל!',
      theme: 'מעורב',
      puzzleCount: 10,
      puzzleMix: [
        { difficulty: Difficulty.EASY, count: 6 },
        { difficulty: Difficulty.MEDIUM, count: 3 },
        { difficulty: Difficulty.HARD, count: 1 },
      ],
    },
    {
      name: 'אוסף תשחצים 2',
      description: '10 תשחצים לפתרון',
      theme: 'מעורב',
      puzzleCount: 10,
    },
    {
      name: 'אוסף תשחצים 3',
      description: '10 תשחצים לפתרון',
      theme: 'מעורב',
      puzzleCount: 10,
    },
    {
      name: 'אוסף תשחצים 4',
      description: '10 תשחצים לפתרון',
      theme: 'מעורב',
      puzzleCount: 10,
    },
    {
      name: 'אוסף תשחצים 5',
      description: '10 תשחצים לפתרון',
      theme: 'מעורב',
      puzzleCount: 10,
    },
    {
      name: 'אוסף תשחצים 6',
      description: '10 תשחצים לפתרון',
      theme: 'מעורב',
      puzzleCount: 10,
    },
    {
      name: 'אוסף תשחצים 7',
      description: '10 תשחצים לפתרון',
      theme: 'מעורב',
      puzzleCount: 10,
    },
    {
      name: 'אוסף תשחצים 8',
      description: '10 תשחצים לפתרון',
      theme: 'מעורב',
      puzzleCount: 10,
    },
    {
      name: 'אוסף תשחצים 9',
      description: '10 תשחצים לפתרון',
      theme: 'מעורב',
      puzzleCount: 10,
    },
    {
      name: 'אוסף תשחצים 10',
      description: '10 תשחצים לפתרון',
      theme: 'מעורב',
      puzzleCount: 10,
    },
  ],
};

const MISC_CATEGORY = language === 'he' ? 'כללי' : 'Misc';
const puzzleTitle = (index: number) => language === 'he' ? `#${index}` : `Puzzle #${index}`;

const packageDefinitions = packageDefinitionsByLanguage[language].map((def, index) => ({
  ...def,
  iconName: iconNames[index % iconNames.length],
  gradientColors: gradientPalette[index % gradientPalette.length],
}));

async function ensureMongoConnection(): Promise<void> {
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().command({ ping: 1 });
      return;
    }
  } catch {
    // reconnect below
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => undefined);
  }
  await connectToDatabase();
}

function getDifficultyDistribution(
  def: { puzzleCount: number; puzzleMix?: Array<{ difficulty: Difficulty; count: number }> }
): Array<{ difficulty: Difficulty; count: number }> {
  if (def.puzzleMix) return def.puzzleMix.filter(d => d.count > 0);

  const easy = Math.round(def.puzzleCount * 0.6);
  const medium = Math.round(def.puzzleCount * 0.4);
  
  const distribution = [
    { difficulty: Difficulty.EASY, count: easy },
    { difficulty: Difficulty.MEDIUM, count: medium },
  ];
  
  // Adjust for rounding errors
  const total = easy + medium;
  const diff = def.puzzleCount - total;
  if (diff !== 0) {
    distribution[0].count += diff;
  }
  
  return distribution.filter(d => d.count > 0);
}

function generatePackagePuzzles(
  def: (typeof packageDefinitions)[number],
  startIndex: number
): { puzzles: any[]; nextIndex: number; difficultyDistribution: Array<{ difficulty: Difficulty; count: number }> } {
  const difficultyDistribution = getDifficultyDistribution(def);
  const generatedPuzzles: any[] = [];
  const packageSizes = language === 'he' ? mixSizes(def.puzzleCount) : undefined;
  let sizeOffset = 0;
  let globalPuzzleIndex = startIndex;

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
      rows: language === 'he' ? 13 : 8,
      cols: language === 'he' ? 13 : 8,
      sizes,
      language,
      // Match daily worker budget so text packages fill reliably.
      attempts: language === 'he' ? 48 : undefined,
    });
    const validPuzzles = filterValidPuzzles(batch, validatePuzzleBoundaries);
    generatedPuzzles.push(...validPuzzles);
    globalPuzzleIndex += validPuzzles.length;

    if (validPuzzles.length < count) {
      console.log(`   ⚠️  Got ${validPuzzles.length}/${count} valid ${difficulty} puzzles`);
    }
  }

  return {
    puzzles: generatedPuzzles,
    nextIndex: globalPuzzleIndex,
    difficultyDistribution,
  };
}

type PreparedPackage = {
  order: number;
  def: (typeof packageDefinitions)[number];
  puzzles: any[];
  difficultyDistribution: Array<{ difficulty: Difficulty; count: number }>;
};

async function persistPreparedPackages(prepared: PreparedPackage[]): Promise<void> {
  for (const { order, def, puzzles, difficultyDistribution } of prepared) {
    await ensureMongoConnection();

    const existing = await PuzzlePackage.findOne({ name: def.name, language });
    if (existing) {
      await UserPuzzleProgress.deleteMany({ puzzleId: { $in: existing.puzzleIds } });
      await Puzzle.deleteMany({ _id: { $in: existing.puzzleIds } });
    }

    const savedPuzzles = await Puzzle.insertMany(puzzles);
    const puzzleIds = savedPuzzles.map(p => p._id as mongoose.Types.ObjectId);

    const difficultyBreakdown = difficultyDistribution
      .map(d => `${d.count} ${d.difficulty}`)
      .join(', ');
    console.log(`   💾 Saved ${puzzles.length}/${def.puzzleCount} puzzles for ${def.name} (${difficultyBreakdown})`);

    let packageId: mongoose.Types.ObjectId;
    if (existing) {
      existing.description = def.description;
      existing.theme = def.theme;
      existing.puzzleCount = puzzleIds.length;
      existing.puzzleIds = puzzleIds;
      existing.iconName = def.iconName;
      existing.gradientColors = def.gradientColors as [string, string];
      existing.order = order;
      await existing.save();
      packageId = existing._id as mongoose.Types.ObjectId;
    } else {
      const newPackage = new PuzzlePackage({
        name: def.name,
        description: def.description,
        theme: def.theme,
        language,
        puzzleCount: puzzleIds.length,
        puzzleIds,
        order,
        iconName: def.iconName,
        gradientColors: def.gradientColors,
      });
      await newPackage.save();
      packageId = newPackage._id as mongoose.Types.ObjectId;
    }

    await Promise.all(puzzleIds.map((id, j) =>
      Puzzle.updateOne(
        { _id: id },
        { $set: { packageId, title: puzzleTitle(j + 1) } }
      )
    ));
  }
}

async function printSummary(): Promise<void> {
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
    if (language === 'he') {
      const ordered = [...puzzles].sort((a, b) => String(a.title).localeCompare(String(b.title), 'he', { numeric: true }));
      for (const p of ordered) {
        const items = p.puzzleItems || [];
        console.log(`      ${p.title} (${p.difficulty}): ${items.length} clues`);
      }
    }
  }

  console.log('='.repeat(60));
  console.log(`   Total packages: ${allPackages.length}`);
  console.log(`   Total puzzles in packages: ${totalPuzzleSlots}`);
  console.log('='.repeat(60));
}

const seedPackages = async () => {
  try {
    await connectToDatabase();

    if (forceReplace && packageNumber !== null) {
      throw new Error('Use either --force (all packages) or --package N, not both');
    }

    if (packageNumber !== null) {
      if (!Number.isInteger(packageNumber) || packageNumber < 1 || packageNumber > packageDefinitions.length) {
        throw new Error(`--package must be 1..${packageDefinitions.length} for ${language}`);
      }
      console.log(`📦 Replacing package ${packageNumber} (${language}) only\n`);

      const i = packageNumber - 1;
      const def = packageDefinitions[i];
      console.log(`\n📦 Generating ${def.name} (${def.puzzleCount} puzzles)...`);
      const { puzzles, difficultyDistribution } = generatePackagePuzzles(def, 1);
      if (puzzles.length === 0) {
        throw new Error(`No valid puzzles generated for ${def.name}`);
      }
      await persistPreparedPackages([{ order: i, def, puzzles, difficultyDistribution }]);
      await printSummary();
      console.log('\n✅ Package seeding completed successfully!');
      await closeDatabaseAndExit(0);
      return;
    }

    if (forceReplace) {
      console.log(`📦 Force regenerating all ${packageDefinitions.length} packages (${language})`);
      console.log('   Generate first; wipe packages/progress only after all puzzles are ready.\n');

      const prepared: PreparedPackage[] = [];
      let globalPuzzleIndex = 1;

      for (let i = 0; i < packageDefinitions.length; i++) {
        const def = packageDefinitions[i];
        console.log(`\n📦 Generating ${def.name} (${def.puzzleCount} puzzles)...`);
        const { puzzles, nextIndex, difficultyDistribution } = generatePackagePuzzles(def, globalPuzzleIndex);
        globalPuzzleIndex = nextIndex;

        if (puzzles.length < def.puzzleCount) {
          throw new Error(
            `Aborting before wipe: ${def.name} only got ${puzzles.length}/${def.puzzleCount} puzzles`
          );
        }
        prepared.push({ order: i, def, puzzles, difficultyDistribution });
        console.log(`   ✅ Ready ${puzzles.length}/${def.puzzleCount} puzzles (held in memory)`);
      }

      const totalReady = prepared.reduce((sum, p) => sum + p.puzzles.length, 0);
      console.log(`\n✅ All ${prepared.length} packages ready (${totalReady} puzzles). Wiping old packages...`);
      await ensureMongoConnection();
      await clearPackagesForLanguage(language);
      console.log('💾 Inserting new packages...\n');
      await persistPreparedPackages(prepared);
      await printSummary();
      console.log('\n✅ Package seeding completed successfully!');
      await closeDatabaseAndExit(0);
      return;
    }

    console.log(`📦 Creating ${packageDefinitions.length} packages (${language}) with difficulty distribution...\n`);

    let globalPuzzleIndex = 1;
    for (let i = 0; i < packageDefinitions.length; i++) {
      await ensureMongoConnection();
      const def = packageDefinitions[i];
      const existing = await PuzzlePackage.findOne({ name: def.name, language });
      if (existing) {
        console.log(`\n📦 Skipping ${def.name} — already exists (${existing.puzzleCount} puzzles)`);
        continue;
      }

      console.log(`\n📦 Creating ${def.name} (${def.puzzleCount} puzzles)...`);
      const { puzzles, nextIndex, difficultyDistribution } = generatePackagePuzzles(def, globalPuzzleIndex);
      globalPuzzleIndex = nextIndex;

      if (puzzles.length === 0) {
        console.log(`   ⚠️  No valid puzzles generated for ${def.name}, skipping...`);
        continue;
      }

      await persistPreparedPackages([{ order: i, def, puzzles, difficultyDistribution }]);
    }

    await printSummary();
    console.log('\n✅ Package seeding completed successfully!');
    await closeDatabaseAndExit(0);
  } catch (error) {
    await handleScriptError(error);
  }
};

seedPackages();
