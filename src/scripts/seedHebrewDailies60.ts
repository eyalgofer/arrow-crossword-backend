/**
 * Generate Hebrew 13–15 daily puzzles with 2 image clues and assign them
 * from today through the next three months (unless --count is set).
 *
 * Tries 13×13, then 14×14, then 15×15. Never smaller than 13×13.
 *
 * Usage:
 *   npx ts-node src/scripts/seedHebrewDailies60.ts
 *   npx ts-node src/scripts/seedHebrewDailies60.ts --count 1
 *   npx ts-node src/scripts/seedHebrewDailies60.ts --strict   # require 13x13
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Puzzle } from '../models/Puzzle';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { PuzzleGenerator } from './generators/puzzlesGenerator';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { assignPuzzleToDate, getDayOfYear } from '../utils/dailyPuzzleUtils';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';
import {
  loadGeneratedImageClueCatalog,
  loadImageClueCatalogFromMongo,
} from './generators/imageClueCatalog';
import { IMAGE_CLUE_SIZE_LADDER } from './utils/gridSizes';
import { normalizeWord } from './generators/validation-utils';

dotenv.config();

const countArgIndex = process.argv.indexOf('--count');
const STRICT_13 = process.argv.includes('--strict');
const ROWS = 13;
const COLS = 13;
const CATEGORY = 'יומי';
const LANGUAGE = 'he' as const;
const IMAGE_COUNT = 2;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function defaultCount(): number {
  const start = addDays(new Date(), 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

const COUNT = countArgIndex !== -1 ? Number(process.argv[countArgIndex + 1]) : defaultCount();

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

async function replaceDailyAssignment(
  newPuzzleId: mongoose.Types.ObjectId,
  date: Date
): Promise<void> {
  const normalized = addDays(date, 0);
  const year = normalized.getFullYear();
  const dayOfYear = getDayOfYear(normalized);
  const existing = await DailyPuzzle.findOne({ dayOfYear, year, language: LANGUAGE });
  const oldId = existing?.puzzleId;

  await assignPuzzleToDate(newPuzzleId, normalized);

  if (oldId && String(oldId) !== String(newPuzzleId)) {
    await UserPuzzleProgress.deleteMany({ puzzleId: oldId });
    const oldPuzzle = await Puzzle.findById(oldId);
    if (oldPuzzle && !oldPuzzle.packageId) {
      await Puzzle.deleteOne({ _id: oldId });
    }
  }
}

const main = async () => {
  try {
    await connectToDatabase();

    const mongoCatalog = await loadImageClueCatalogFromMongo();
    const localCatalog = loadGeneratedImageClueCatalog();
    const byAnswer = new Map(mongoCatalog.map((entry) => [normalizeWord(entry.answer), entry]));
    for (const entry of localCatalog) {
      if (entry.answer && entry.imageUrl) byAnswer.set(normalizeWord(entry.answer), entry);
    }
    const catalog = [...byAnswer.values()];
    if (catalog.length < IMAGE_COUNT) {
      throw new Error(
        `Need image clues, found ${catalog.length}. Run scripts/arrow-image-pipeline \`npm run process\` first.`
      );
    }

    const startDay = addDays(new Date(), 0);
    const lastDay = addDays(startDay, COUNT - 1);
    const sizes = STRICT_13 ? [{ rows: ROWS, cols: COLS }] : IMAGE_CLUE_SIZE_LADDER;
    const sizeMode = STRICT_13 ? 'strict 13x13' : '13→14→15 with 2 images';
    console.log(
      `📅 Generating ${COUNT} Hebrew dailies (${sizeMode}) ` +
      `${startDay.toLocaleDateString()} → ${lastDay.toLocaleDateString()}\n`
    );

    const generator = new PuzzleGenerator(LANGUAGE, catalog);
    const savedIds: string[] = [];

    for (let i = 0; i < COUNT; i++) {
      const date = addDays(startDay, i);
      let saved = null;
      for (let attempt = 1; attempt <= 2 && !saved; attempt++) {
        let puzzle = null;
        for (const size of sizes) {
          const generated = generator.generateBatch({
            count: 1,
            category: CATEGORY,
            getTitle: () => `תשחץ יומי ${i + 1}`,
            rows: size.rows,
            cols: size.cols,
            strictSize: true,
            imageClueCount: IMAGE_COUNT,
            imageClueAttempts: 48,
          });
          if (generated[0]) {
            puzzle = generated[0];
            break;
          }
        }
        if (!puzzle) continue;
        const errors = validatePuzzleBoundaries(puzzle);
        if (errors.length > 0) {
          console.warn(`   ⚠️  Puzzle ${i + 1} failed validation (try ${attempt})`);
          continue;
        }
        if (puzzle.grid.rows < 13 || puzzle.grid.cols < 13) {
          console.warn(
            `   ⚠️  Got ${puzzle.grid.rows}x${puzzle.grid.cols}, wanted ≥13x13 (try ${attempt})`
          );
          continue;
        }

        await ensureMongoConnection();
        const inserted = await Puzzle.insertMany([{ ...puzzle, title: `תשחץ יומי ${i + 1}` }]);
        saved = inserted[0];
      }

      if (!saved) {
        console.error(
          `❌ Could not generate a valid puzzle for day ${i + 1} (${date.toLocaleDateString()})`
        );
        continue;
      }

      await ensureMongoConnection();
      await replaceDailyAssignment(saved._id as mongoose.Types.ObjectId, date);
      savedIds.push(String(saved._id));
      const images = saved.puzzleItems.filter((item) => item.clueType === 'image').length;
      console.log(
        `   ${date.toLocaleDateString()} → ${saved.title} ` +
        `(${saved.grid.rows}x${saved.grid.cols}, ${saved.puzzleItems.length} clues, ${images} images)`
      );
      if (COUNT === 1) {
        console.log(`   puzzleId: ${saved._id}`);
        for (const item of saved.puzzleItems) {
          const enumeration = item.enumeration;
          const enumLabel = enumeration && enumeration.length > 1 ? ` (${enumeration.join(',')})` : '';
          console.log(`   ${item.number}. ${item.clue}${enumLabel} = ${item.answer}`);
        }
      }
    }

    console.log(`\n✅ Assigned ${savedIds.length}/${COUNT} Hebrew dailies`);
    console.log(`📊 Total daily assignments: ${await DailyPuzzle.countDocuments()}`);
    await closeDatabaseAndExit(savedIds.length === COUNT ? 0 : 1);
  } catch (error) {
    await handleScriptError(error);
  }
};

main();
