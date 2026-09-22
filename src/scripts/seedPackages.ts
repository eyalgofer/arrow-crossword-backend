import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
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
import { GridSize, mixSizes } from './utils/gridSizes';

dotenv.config();

// Usage: ts-node src/scripts/seedPackages.ts [--lang he] [--package 1] [--force] [--parallel 10]
const langArgIndex = process.argv.indexOf('--lang');
const language: Language = langArgIndex !== -1 && process.argv[langArgIndex + 1] === 'he' ? 'he' : 'en';
const packageArgIndex = process.argv.indexOf('--package');
const packageNumber = packageArgIndex !== -1 ? parseInt(process.argv[packageArgIndex + 1], 10) : null;
const forceReplace = process.argv.includes('--force');
const parallelArgIndex = process.argv.indexOf('--parallel');
const parallelArg =
  parallelArgIndex !== -1 ? parseInt(process.argv[parallelArgIndex + 1], 10) : NaN;

const ROOT = process.cwd();
const PACKAGE_OUT_DIR = path.join(ROOT, 'tmp-package-puzzles');
/** Default: use most cores (10 on this Mac). Override with --parallel N. */
const PACKAGE_PARALLEL =
  Number.isInteger(parallelArg) && parallelArg > 0 ? parallelArg : 10;
const PACKAGE_WORKER_ATTEMPTS = 48;
const PACKAGE_MAX_LAUNCHES_PER_SLOT = 12;

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
      rows: language === 'he' ? 14 : 8,
      cols: language === 'he' ? 14 : 8,
      sizes,
      language,
      // Match daily worker budget so text packages fill reliably.
      attempts: language === 'he' ? 64 : undefined,
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

type PackageSlot = {
  packageOrder: number;
  slotInPackage: number;
  difficulty: Difficulty;
  size: GridSize;
};

function buildHebrewPackageSlots(): PackageSlot[] {
  const slots: PackageSlot[] = [];
  for (let i = 0; i < packageDefinitions.length; i++) {
    const def = packageDefinitions[i];
    const difficultyDistribution = getDifficultyDistribution(def);
    const sizes = mixSizes(def.puzzleCount);
    let sizeOffset = 0;
    let slotInPackage = 0;
    for (const { difficulty, count } of difficultyDistribution) {
      for (let n = 0; n < count; n++) {
        slots.push({
          packageOrder: i,
          slotInPackage,
          difficulty,
          size: sizes[sizeOffset] ?? { rows: 14, cols: 14 },
        });
        sizeOffset += 1;
        slotInPackage += 1;
      }
    }
  }
  return slots;
}

function runPackageWorker(
  launchIndex: number,
  slot: PackageSlot,
  outPath: string
): Promise<any | null> {
  return new Promise((resolve) => {
    const child = spawn(
      'npx',
      [
        'ts-node',
        'src/scripts/generateOnePackagePuzzle.ts',
        '--out',
        outPath,
        '--difficulty',
        slot.difficulty,
        '--rows',
        String(slot.size.rows),
        '--cols',
        String(slot.size.cols),
        '--attempts',
        String(PACKAGE_WORKER_ATTEMPTS),
        '--index',
        String(launchIndex),
      ],
      { cwd: ROOT, stdio: 'inherit' }
    );
    child.on('exit', (code) => {
      if (code !== 0 || !fs.existsSync(outPath)) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(fs.readFileSync(outPath, 'utf8')));
      } catch {
        resolve(null);
      }
    });
    child.on('error', () => resolve(null));
  });
}

function loadExistingSlotPuzzle(packageOrder: number, slotInPackage: number): any | null {
  if (!fs.existsSync(PACKAGE_OUT_DIR)) return null;
  const prefix = `pkg-${packageOrder + 1}-${slotInPackage + 1}-try`;
  const files = fs
    .readdirSync(PACKAGE_OUT_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .sort((a, b) => {
      const tryA = parseInt(a.slice(prefix.length).replace(/\.json$/, ''), 10);
      const tryB = parseInt(b.slice(prefix.length).replace(/\.json$/, ''), 10);
      return (Number.isFinite(tryB) ? tryB : 0) - (Number.isFinite(tryA) ? tryA : 0);
    });
  for (const file of files) {
    try {
      const puzzle = JSON.parse(fs.readFileSync(path.join(PACKAGE_OUT_DIR, file), 'utf8'));
      if (
        puzzle?.grid?.rows >= 13 &&
        puzzle?.grid?.cols >= 13 &&
        (puzzle.puzzleItems?.length ?? 0) > 0
      ) {
        return puzzle;
      }
    } catch {
      // skip corrupt
    }
  }
  return null;
}

/** Generate all Hebrew package puzzles via parallel workers (daily-style). */
async function generateAllHebrewPackagesInParallel(): Promise<PreparedPackage[]> {
  fs.mkdirSync(PACKAGE_OUT_DIR, { recursive: true });
  const slots = buildHebrewPackageSlots();
  const results: Array<any | null> = Array(slots.length).fill(null);
  const launchesForSlot = Array(slots.length).fill(0);
  let inFlight = 0;
  let launchCounter = 0;
  let completed = 0;

  // Resume: reuse ready JSON from a prior run so we don't throw away finished slots.
  for (let i = 0; i < slots.length; i++) {
    const existing = loadExistingSlotPuzzle(slots[i].packageOrder, slots[i].slotInPackage);
    if (!existing) continue;
    results[i] = existing;
    completed += 1;
    console.log(
      `♻️  Resume package ${slots[i].packageOrder + 1}/#${slots[i].slotInPackage + 1} ` +
        `(${completed}/${slots.length})`
    );
  }

  console.log(
    `🚀 Parallel generate ${slots.length} package puzzles ` +
      `(workers=${PACKAGE_PARALLEL}, attempts=${PACKAGE_WORKER_ATTEMPTS}, ` +
      `already have ${completed})`
  );

  if (completed >= slots.length) {
    // fall through to assemble prepared
  } else {
  await new Promise<void>((resolve) => {
    const maybeDone = () => {
      if (completed >= slots.length) {
        resolve();
        return;
      }
      const pending = slots
        .map((_, i) => i)
        .filter((i) => results[i] == null && launchesForSlot[i] < PACKAGE_MAX_LAUNCHES_PER_SLOT);
      if (inFlight === 0 && pending.length === 0) {
        resolve();
        return;
      }
      pump();
    };

    const pump = () => {
      while (inFlight < PACKAGE_PARALLEL) {
        // Prefer slots with no result and the fewest launches so workers spread
        // across different puzzles instead of stacking retries on slot 0.
        let slotIndex = -1;
        let bestLaunches = Infinity;
        for (let i = 0; i < slots.length; i++) {
          if (results[i] != null) continue;
          if (launchesForSlot[i] >= PACKAGE_MAX_LAUNCHES_PER_SLOT) continue;
          if (launchesForSlot[i] < bestLaunches) {
            bestLaunches = launchesForSlot[i];
            slotIndex = i;
          }
        }
        if (slotIndex < 0) break;

        const slot = slots[slotIndex];
        launchesForSlot[slotIndex] += 1;
        launchCounter += 1;
        inFlight += 1;
        const launchId = launchCounter;
        const outPath = path.join(
          PACKAGE_OUT_DIR,
          `pkg-${slot.packageOrder + 1}-${slot.slotInPackage + 1}-try${launchesForSlot[slotIndex]}.json`
        );
        console.log(
          `—— Launch #${launchId}: package ${slot.packageOrder + 1} slot ${slot.slotInPackage + 1} ` +
            `${slot.difficulty} ${slot.size.rows}x${slot.size.cols} ` +
            `(in-flight ${inFlight}, done ${completed}/${slots.length}) ——`
        );
        const capturedSlot = slotIndex;
        runPackageWorker(launchId, slot, outPath)
          .then((puzzle) => {
            inFlight -= 1;
            if (puzzle && results[capturedSlot] == null) {
              results[capturedSlot] = puzzle;
              completed += 1;
              console.log(
                `✅ Slot package ${slot.packageOrder + 1}/#${slot.slotInPackage + 1} ready ` +
                  `(${completed}/${slots.length})`
              );
            }
            maybeDone();
          })
          .catch(() => {
            inFlight -= 1;
            maybeDone();
          });
      }
      if (completed >= slots.length || (inFlight === 0 &&
        slots.every((_, i) => results[i] != null || launchesForSlot[i] >= PACKAGE_MAX_LAUNCHES_PER_SLOT))) {
        resolve();
      }
    };

    pump();
  });
  }

  const missing = results.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
  if (missing.length > 0) {
    throw new Error(
      `Aborting before wipe: failed to generate ${missing.length}/${slots.length} package puzzles ` +
        `(first missing slot index ${missing[0]})`
    );
  }

  const prepared: PreparedPackage[] = [];
  for (let i = 0; i < packageDefinitions.length; i++) {
    const def = packageDefinitions[i];
    const difficultyDistribution = getDifficultyDistribution(def);
    const ordered = slots
      .map((slot, idx) => (slot.packageOrder === i ? results[idx] : null))
      .filter(Boolean);
    prepared.push({
      order: i,
      def,
      puzzles: ordered,
      difficultyDistribution,
    });
  }
  return prepared;
}

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
      if (language !== 'he') {
        throw new Error('--force is only supported for --lang he');
      }
      console.log(`📦 Force regenerating all ${packageDefinitions.length} packages (${language})`);
      console.log('   Parallel generate first; wipe packages/progress only after all puzzles are ready.\n');

      // Close DB while CPU-bound workers run (avoid idle Atlas disconnect noise).
      await mongoose.connection.close().catch(() => undefined);

      const prepared = await generateAllHebrewPackagesInParallel();
      const totalReady = prepared.reduce((sum, p) => sum + p.puzzles.length, 0);
      console.log(`\n✅ All ${prepared.length} packages ready (${totalReady} puzzles). Wiping old packages...`);
      await connectToDatabase();
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
