/**
 * Replace every Hebrew package puzzle in place with a fresh 10–12 framed board.
 * Puzzle _ids and package.puzzleIds stay put, so completed counts do not move.
 *
 * Usage:
 *   npx ts-node src/scripts/replaceHebrewPackagePuzzles.ts
 *   npx ts-node src/scripts/replaceHebrewPackagePuzzles.ts --parallel 4
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Puzzle } from '../models/Puzzle';
import { PuzzlePackage } from '../models/PuzzlePackage';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { Difficulty } from '../types';
import { PACKAGE_GRID_SIZE_MIX, GridSize } from './utils/gridSizes';
import { writeRecentDailyContent, RecentDailyContent } from './utils/recentDailyContent';
import { connectToDatabase, closeDatabaseAndExit, handleScriptError } from './utils/scriptUtils';

dotenv.config();

const parallelArgIndex = process.argv.indexOf('--parallel');
const parallelArg = parallelArgIndex !== -1 ? parseInt(process.argv[parallelArgIndex + 1], 10) : NaN;
const PARALLEL = Number.isInteger(parallelArg) && parallelArg > 0 ? parallelArg : 4;
const WORKER_BUDGET_MS = 120000;
const MAX_LAUNCHES_PER_SLOT = 12;

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'tmp-replace-packages');
const RECENT_FILE = path.join(OUT_DIR, 'recent.json');

const SLOT_DIFFICULTIES: Difficulty[] = [
  Difficulty.EASY,
  Difficulty.EASY,
  Difficulty.EASY,
  Difficulty.EASY,
  Difficulty.EASY,
  Difficulty.MEDIUM,
  Difficulty.MEDIUM,
  Difficulty.MEDIUM,
  Difficulty.HARD,
  Difficulty.HARD,
];

interface PackageSlot {
  packageName: string;
  packageOrder: number;
  slotInPackage: number;
  puzzleId: mongoose.Types.ObjectId;
  difficulty: Difficulty;
  size: GridSize;
}

function answersOf(puzzle: { puzzleItems?: Array<{ clueType?: string; answer?: string }> }): string[] {
  return (puzzle.puzzleItems ?? [])
    .filter((item) => item.clueType !== 'image' && item.answer)
    .map((item) => String(item.answer));
}

function writeAvoidFile(puzzles: Array<{ puzzleItems?: Array<{ clueType?: string; answer?: string }> } | null>): void {
  const answers = new Set<string>();
  for (const puzzle of puzzles) {
    if (!puzzle) continue;
    for (const answer of answersOf(puzzle)) answers.add(answer);
  }
  const content: RecentDailyContent = { answers: [...answers], clues: [] };
  writeRecentDailyContent(RECENT_FILE, content);
}

function loadExistingSlotPuzzle(slot: PackageSlot): any | null {
  if (!fs.existsSync(OUT_DIR)) return null;
  const prefix = `pkg-${slot.packageOrder + 1}-${slot.slotInPackage + 1}-try`;
  const files = fs
    .readdirSync(OUT_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .sort((a, b) => {
      const tryA = parseInt(a.slice(prefix.length).replace(/\.json$/, ''), 10);
      const tryB = parseInt(b.slice(prefix.length).replace(/\.json$/, ''), 10);
      return (Number.isFinite(tryB) ? tryB : 0) - (Number.isFinite(tryA) ? tryA : 0);
    });
  for (const file of files) {
    try {
      const puzzle = JSON.parse(fs.readFileSync(path.join(OUT_DIR, file), 'utf8'));
      if (
        puzzle?.grid?.rows === slot.size.rows &&
        puzzle?.grid?.cols === slot.size.cols &&
        puzzle?.difficulty === slot.difficulty &&
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

function runWorker(launchIndex: number, slot: PackageSlot, outPath: string): Promise<any | null> {
  return new Promise((resolve) => {
    const child = spawn(
      'npx',
      [
        'ts-node',
        'src/scripts/generateOnePackagePuzzle.ts',
        '--profile',
        'daily',
        '--out',
        outPath,
        '--difficulty',
        slot.difficulty,
        '--rows',
        String(slot.size.rows),
        '--cols',
        String(slot.size.cols),
        '--budget',
        String(WORKER_BUDGET_MS),
        '--index',
        String(launchIndex),
        '--recent',
        RECENT_FILE,
      ],
      { cwd: ROOT, stdio: 'inherit' }
    );
    child.on('exit', (code) => {
      if (code !== 0 || !fs.existsSync(outPath)) {
        resolve(null);
        return;
      }
      try {
        const puzzle = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        if (puzzle?.grid?.rows !== slot.size.rows || puzzle?.grid?.cols !== slot.size.cols) {
          resolve(null);
          return;
        }
        resolve(puzzle);
      } catch {
        resolve(null);
      }
    });
    child.on('error', () => resolve(null));
  });
}

async function generateAll(slots: PackageSlot[]): Promise<any[]> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const results: Array<any | null> = Array(slots.length).fill(null);
  const launchesForSlot = Array(slots.length).fill(0);
  let inFlight = 0;
  let launchCounter = 0;
  let completed = 0;

  for (let i = 0; i < slots.length; i++) {
    const existing = loadExistingSlotPuzzle(slots[i]);
    if (!existing) continue;
    results[i] = existing;
    completed += 1;
    console.log(
      `♻️  Resume package ${slots[i].packageOrder + 1}/#${slots[i].slotInPackage + 1} ` +
        `(${completed}/${slots.length})`
    );
  }
  writeAvoidFile(results);

  console.log(
    `🚀 Parallel generate ${slots.length} package puzzles ` +
      `(workers=${PARALLEL}, budget=${WORKER_BUDGET_MS}ms, already have ${completed})`
  );

  if (completed < slots.length) {
    await new Promise<void>((resolve) => {
      const maybeDone = () => {
        if (completed >= slots.length) {
          resolve();
          return;
        }
        const pending = slots
          .map((_, i) => i)
          .filter((i) => results[i] == null && launchesForSlot[i] < MAX_LAUNCHES_PER_SLOT);
        if (inFlight === 0 && pending.length === 0) {
          resolve();
          return;
        }
        pump();
      };

      const pump = () => {
        while (inFlight < PARALLEL) {
          let slotIndex = -1;
          let bestLaunches = Infinity;
          for (let i = 0; i < slots.length; i++) {
            if (results[i] != null) continue;
            if (launchesForSlot[i] >= MAX_LAUNCHES_PER_SLOT) continue;
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
            OUT_DIR,
            `pkg-${slot.packageOrder + 1}-${slot.slotInPackage + 1}-try${launchesForSlot[slotIndex]}.json`
          );
          console.log(
            `—— Launch #${launchId}: ${slot.packageName} #${slot.slotInPackage + 1} ` +
              `${slot.difficulty} ${slot.size.rows}x${slot.size.cols} ` +
              `(in-flight ${inFlight}, done ${completed}/${slots.length}) ——`
          );
          const capturedSlot = slotIndex;
          runWorker(launchId, slot, outPath)
            .then((puzzle) => {
              inFlight -= 1;
              if (puzzle && results[capturedSlot] == null) {
                results[capturedSlot] = puzzle;
                completed += 1;
                writeAvoidFile(results);
                console.log(
                  `✅ ${slot.packageName} #${slot.slotInPackage + 1} ready (${completed}/${slots.length})`
                );
              }
              maybeDone();
            })
            .catch(() => {
              inFlight -= 1;
              maybeDone();
            });
        }
        if (
          completed >= slots.length ||
          (inFlight === 0 &&
            slots.every((_, i) => results[i] != null || launchesForSlot[i] >= MAX_LAUNCHES_PER_SLOT))
        ) {
          resolve();
        }
      };

      pump();
    });
  }

  const missing = results.map((puzzle, i) => (puzzle ? -1 : i)).filter((i) => i >= 0);
  if (missing.length > 0) {
    const first = slots[missing[0]];
    throw new Error(
      `Aborting before any database write: failed to generate ${missing.length}/${slots.length} puzzles ` +
        `(first missing ${first.packageName} #${first.slotInPackage + 1})`
    );
  }
  return results as any[];
}

async function completedCountByPuzzle(ids: mongoose.Types.ObjectId[]): Promise<Map<string, number>> {
  const rows = await UserPuzzleProgress.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
    { $match: { puzzleId: { $in: ids }, isCompleted: true } },
    { $group: { _id: '$puzzleId', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.n]));
}

function assertCompletedUnchanged(
  before: Map<string, number>,
  after: Map<string, number>,
  ids: mongoose.Types.ObjectId[]
): void {
  for (const id of ids) {
    const key = String(id);
    const was = before.get(key) ?? 0;
    const now = after.get(key) ?? 0;
    if (was !== now) {
      throw new Error(`Completed count changed for puzzle ${key}: ${was} → ${now}`);
    }
  }
}

async function refreshProgress(
  puzzleId: mongoose.Types.ObjectId,
  items: Array<{ number: number; direction: string }>
): Promise<void> {
  const completedClueIds = items.map((item) => `${item.number}|${item.direction}`);
  const totalClues = items.length;
  await UserPuzzleProgress.updateMany(
    { puzzleId, isCompleted: true },
    { $set: { completedClueIds, completedCluesCount: totalClues, totalClues } }
  );
  await UserPuzzleProgress.updateMany(
    { puzzleId, isCompleted: { $ne: true } },
    {
      $set: {
        completedClueIds: [],
        completedCluesCount: 0,
        elapsedTime: 0,
        totalClues,
      },
    }
  );
}

async function buildSlots(): Promise<PackageSlot[]> {
  const packages = await PuzzlePackage.find({ language: 'he' }).sort({ order: 1 }).lean();
  if (packages.length !== 10) {
    throw new Error(`Expected 10 Hebrew packages, found ${packages.length}`);
  }
  const slots: PackageSlot[] = [];
  let sizeCursor = 0;
  for (const pkg of packages) {
    if (pkg.puzzleIds.length !== 10 || pkg.puzzleCount !== 10) {
      throw new Error(
        `${pkg.name} has ${pkg.puzzleIds.length} puzzle ids (count ${pkg.puzzleCount}); expected 10`
      );
    }
    pkg.puzzleIds.forEach((puzzleId, slotInPackage) => {
      slots.push({
        packageName: pkg.name,
        packageOrder: pkg.order,
        slotInPackage,
        puzzleId: puzzleId as mongoose.Types.ObjectId,
        difficulty: SLOT_DIFFICULTIES[slotInPackage],
        size: PACKAGE_GRID_SIZE_MIX[sizeCursor % PACKAGE_GRID_SIZE_MIX.length],
      });
      sizeCursor += 1;
    });
  }
  return slots;
}

async function main(): Promise<void> {
  await connectToDatabase();
  const slots = await buildSlots();
  console.log(`📦 ${slots.length} Hebrew package slots, ids kept in place`);
  const generated = await generateAll(slots);

  const ids = slots.map((slot) => slot.puzzleId);
  const before = await completedCountByPuzzle(ids);
  const beforeTotal = [...before.values()].reduce((sum, n) => sum + n, 0);
  console.log(`\n💾 Writing ${generated.length} puzzles. Completed rows before write: ${beforeTotal}`);

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const puzzle = generated[i];
    const updated = await Puzzle.updateOne(
      { _id: slot.puzzleId, packageId: { $exists: true } },
      {
        $set: {
          grid: puzzle.grid,
          puzzleItems: puzzle.puzzleItems,
          difficulty: slot.difficulty,
          estimatedTime: puzzle.estimatedTime,
          coinReward: puzzle.coinReward,
          category: 'כללי',
          language: 'he',
          metadata: {
            templateId: puzzle.metadata?.templateId,
            generationMethod: puzzle.metadata?.generationMethod ?? 'daily-framed',
          },
        },
      }
    );
    if (updated.matchedCount !== 1) {
      throw new Error(`Puzzle ${slot.puzzleId} for ${slot.packageName} #${slot.slotInPackage + 1} was not updated`);
    }
    await refreshProgress(slot.puzzleId, puzzle.puzzleItems);
    console.log(
      `   ${slot.packageName} #${slot.slotInPackage + 1} ${slot.difficulty} ` +
        `${puzzle.grid.rows}x${puzzle.grid.cols} (${puzzle.puzzleItems.length} clues)`
    );
  }

  const after = await completedCountByPuzzle(ids);
  assertCompletedUnchanged(before, after, ids);
  const afterTotal = [...after.values()].reduce((sum, n) => sum + n, 0);
  console.log(`\n✅ Replaced ${slots.length} puzzles. Completed rows unchanged: ${afterTotal}`);
  await closeDatabaseAndExit(0);
}

main().catch((error) => {
  handleScriptError(error);
});
