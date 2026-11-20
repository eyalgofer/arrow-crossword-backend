/**
 * Generate one unassigned Hebrew Saturday preview: 20×20, 4 images, easy clues.
 * Does not create a DailyPuzzle assignment.
 *
 *   npx ts-node src/scripts/generateSaturdayPreview.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Puzzle } from '../models/Puzzle';
import { DailyPuzzle } from '../models/DailyPuzzle';
import { FavPuzzle } from '../models/FavPuzzle';
import { MultiplayerPuzzle } from '../models/MultiplayerPuzzle';
import { Difficulty } from '../types';
import { Puzzle as GeneratedPuzzle } from './core/types';
import { getClueProvider } from './core/clueProvider';
import { generateDailyPuzzle } from './generators/puzzlesGenerator';
import {
  ImageClueCatalogEntry,
  loadGeneratedImageClueCatalog,
  loadImageClueCatalogFromMongo,
} from './generators/imageClueCatalog';
import { contentStats } from './generators/content-quality';
import { getUncoveredCells } from './generators/direction-utils';
import {
  chosenClueDifficultyStats,
} from './generators/puzzle-assembler';
import {
  dailyTargetMisses,
  dailyTargetsFor,
  formatQuality,
  scorePuzzle,
} from './generators/puzzle-quality';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { normalizeWord } from './generators/validation-utils';
import { loadRecentDailyContent } from './utils/recentDailyContent';
import { connectToDatabase } from './utils/scriptUtils';

const ROWS = 20;
const COLS = 20;
const IMAGES = 4;
const OUT = path.join(__dirname, '../../tmp-saturday-20.json');

function mergeCatalogs(
  mongo: ImageClueCatalogEntry[],
  local: ImageClueCatalogEntry[]
): ImageClueCatalogEntry[] {
  const byAnswer = new Map<string, ImageClueCatalogEntry>();
  for (const entry of [...mongo, ...local]) {
    if (!entry.answer || !entry.imageUrl) continue;
    byAnswer.set(normalizeWord(entry.answer), entry);
  }
  return [...byAnswer.values()];
}

async function loadUsedImageAnswers(): Promise<Set<string>> {
  // Photos stay out of favorites, multiplayer, and the last 3 weeks of dailies.
  // Older dailies are allowed so a 20×20 board still has enough pictures to cross.
  const since = new Date();
  since.setDate(since.getDate() - 21);
  const [dailies, favs, multiplayer] = await Promise.all([
    DailyPuzzle.find({ language: 'he', date: { $gte: since } }).select('puzzleId').lean(),
    FavPuzzle.find({ language: 'he' }).select('puzzleId').lean(),
    MultiplayerPuzzle.find({ language: 'he' }).select('puzzleId').lean(),
  ]);
  const ids = [
    ...dailies.map((row) => row.puzzleId),
    ...favs.map((row) => row.puzzleId),
    ...multiplayer.map((row) => row.puzzleId),
  ].filter(Boolean);
  const linked = ids.length ? await Puzzle.find({ _id: { $in: ids } }).select('puzzleItems').lean() : [];
  const used = new Set<string>();
  for (const puzzle of linked) {
    for (const item of puzzle.puzzleItems || []) {
      if (item.clueType === 'image' && item.answer) used.add(normalizeWord(String(item.answer)));
    }
  }
  return used;
}

async function main(): Promise<void> {
  await connectToDatabase();
  const usedImages = await loadUsedImageAnswers();
  const merged = mergeCatalogs(await loadImageClueCatalogFromMongo(), loadGeneratedImageClueCatalog());
  const available = merged.filter((entry) => !usedImages.has(normalizeWord(entry.answer)));
  const byLen = (entry: ImageClueCatalogEntry) => normalizeWord(entry.answer).length;
  const preferred = available.filter((entry) => {
    const n = byLen(entry);
    return n >= 5 && n <= 8;
  });
  const catalog = preferred.length >= 12 ? preferred : available;
  const recent = await loadRecentDailyContent(14);
  console.log(
    `Catalog ${catalog.length} (preferred 5–8: ${preferred.length}, excluded images ${usedImages.size}). ` +
      `Avoiding ${recent.answers.length} recent answers / ${recent.clues.length} recent clues.`
  );
  await mongoose.disconnect();

  const puzzle = generateDailyPuzzle({
    rows: ROWS,
    cols: COLS,
    title: 'שבת גדול',
    category: 'יומי',
    imageClueCount: IMAGES,
    imageClueCatalog: catalog,
    avoidAnswers: recent.answers,
    avoidClues: recent.clues,
    difficulty: Difficulty.EASY,
    targetDifficulty: 1,
    // A strong easy-word penalty stops a 20×20 board from filling. Clues still
    // prefer the easiest high-quality wording, and the fill already prefers common words.
    wordDifficultyWeight: 0.4,
    timeBudgetMs: 8 * 60 * 1000,
    solveMsPerTemplate: 8000,
  });

  if (!puzzle) throw new Error('Generator returned no puzzle');
  const images = puzzle.puzzleItems.filter((item) => item.clueType === 'image');
  const boundary = validatePuzzleBoundaries(puzzle);
  const uncovered = getUncoveredCells(puzzle);
  const misses = dailyTargetMisses(scorePuzzle(puzzle), dailyTargetsFor(images.length, puzzle.grid));
  if (
    puzzle.grid.rows !== ROWS ||
    puzzle.grid.cols !== COLS ||
    images.length !== IMAGES ||
    boundary.length > 0 ||
    uncovered.length > 0 ||
    misses.length > 0 ||
    images.some((item) => !item.imageUrl || !item.answer || !/[\u0590-\u05FF]/.test(item.answer))
  ) {
    console.error(formatQuality(scorePuzzle(puzzle)));
    throw new Error(
      `Puzzle failed checks: images=${images.length} boundary=${boundary.length} ` +
        `uncovered=${uncovered.length} misses=${misses.join('; ')}`
    );
  }

  const provider = getClueProvider('he');
  const clueStats = chosenClueDifficultyStats(puzzle.puzzleItems, (answer) =>
    provider.getScoredClues?.(answer) ?? []
  );
  const content = contentStats(puzzle);
  console.log(formatQuality(scorePuzzle(puzzle)));
  console.log(
    `clue-mean ${clueStats?.mean.toFixed(2) ?? 'n/a'} easy-share ${clueStats?.easyShare.toFixed(2) ?? 'n/a'} ` +
      `fill=${content.avgFillScore.toFixed(2)} clueQ=${content.avgClueQuality.toFixed(2)} ` +
      `top-cat=${content.topCategory}×${content.topCategoryCount}`
  );
  for (const item of puzzle.puzzleItems) {
    const scored = provider.getScoredClues?.(item.answer)?.find((clue) => clue.text === item.clue);
    const tag = item.clueType === 'image' ? 'IMG' : `d${scored?.difficulty ?? '?'}`;
    console.log(`  ${String(item.number).padStart(3)} ${tag} ${item.clue} = ${item.answer}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(puzzle, null, 2));
  await connectToDatabase();
  const saved = await Puzzle.create({
    title: 'שבת גדול',
    difficulty: Difficulty.EASY,
    category: 'יומי',
    language: 'he',
    grid: puzzle.grid,
    puzzleItems: puzzle.puzzleItems,
    estimatedTime: puzzle.estimatedTime,
    coinReward: puzzle.coinReward,
    isActive: true,
    metadata: { generationMethod: 'daily-framed' },
  });
  console.log(`PUZZLE_ID ${saved._id.toString()}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
