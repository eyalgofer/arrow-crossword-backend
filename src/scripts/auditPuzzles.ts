/**
 * Audit Hebrew puzzles against the daily layout and content targets.
 *
 * Usage:
 *   npx ts-node src/scripts/auditPuzzles.ts                    # last 14 days of Hebrew dailies
 *   npx ts-node src/scripts/auditPuzzles.ts --days 30
 *   npx ts-node src/scripts/auditPuzzles.ts --package 3 --puzzle 1
 *   npx ts-node src/scripts/auditPuzzles.ts --from tmp-daily-puzzles/puzzle.json
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Puzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { Puzzle as GeneratedPuzzle } from './core/types';
import { contentStats } from './generators/content-quality';
import { dailyTargetMisses, dailyTargetsFor, formatQuality, scorePuzzle } from './generators/puzzle-quality';
import { connectToDatabase } from './utils/scriptUtils';

function argValue(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? undefined : process.argv[idx + 1];
}

function report(label: string, puzzle: GeneratedPuzzle): boolean {
  const stats = scorePuzzle(puzzle);
  const content = contentStats(puzzle);
  const images = puzzle.puzzleItems.filter((i) => i.clueType === 'image').length;
  const misses = dailyTargetMisses(stats, dailyTargetsFor(images));
  console.log(
    `${misses.length === 0 ? '✅' : '❌'} ${label} ${puzzle.grid.rows}x${puzzle.grid.cols} ` +
      `${puzzle.puzzleItems.length} clues (${images} img)`
  );
  console.log(`   layout:  ${formatQuality(stats)}`);
  console.log(
    `   content: fill=${content.avgFillScore.toFixed(2)} clueQ=${content.avgClueQuality.toFixed(2)} ` +
      `low-fill=${content.lowFillWords.length}${content.lowFillWords.length ? ` [${content.lowFillWords.slice(0, 8).join(' ')}]` : ''} ` +
      `top-cat=${content.topCategory}×${content.topCategoryCount}`
  );
  if (misses.length > 0) console.log(`   misses:  ${misses.join('; ')}`);
  return misses.length === 0;
}

async function main() {
  const fromFile = argValue('--from');
  if (fromFile) {
    const puzzle = JSON.parse(fs.readFileSync(path.resolve(fromFile), 'utf8')) as GeneratedPuzzle;
    report(path.basename(fromFile), puzzle);
    return;
  }

  await connectToDatabase();
  const pkgNumber = argValue('--package');
  if (pkgNumber) {
    const n = parseInt(pkgNumber, 10);
    const pkg =
      (await PuzzlePackage.findOne({ language: 'he', name: `אוסף תשחצים ${n}` })) ??
      (await PuzzlePackage.findOne({ language: 'he', order: n - 1 }));
    if (!pkg) throw new Error(`Hebrew package ${n} not found`);
    const puzzleArg = argValue('--puzzle');
    const ids = puzzleArg ? [pkg.puzzleIds[parseInt(puzzleArg, 10) - 1]] : pkg.puzzleIds;
    for (const id of ids) {
      const doc = await Puzzle.findById(id).lean();
      if (doc) report(`${pkg.name} ${doc.title}`, doc as unknown as GeneratedPuzzle);
    }
    return;
  }

  const days = parseInt(argValue('--days') ?? '14', 10);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const dailies = await DailyPuzzle.find({ language: 'he', date: { $gte: since } }).sort({ date: 1 }).lean();
  let passed = 0;
  for (const daily of dailies) {
    const doc = await Puzzle.findById(daily.puzzleId).lean();
    if (!doc) continue;
    if (report(daily.date.toISOString().slice(0, 10), doc as unknown as GeneratedPuzzle)) passed += 1;
  }
  console.log(`\n${passed}/${dailies.length} dailies meet the daily targets`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect().catch(() => undefined));
