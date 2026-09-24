/**
 * Generate one Hebrew 15×15 image-clue puzzle and write JSON to --out.
 * Used by seed:fav-puzzles / seedHebrewDailies60 in parallel.
 *
 * Usage:
 *   npx ts-node src/scripts/generateOneFav.ts --out tmp-fav-1.json --images 2 --attempts 64 --size 15
 *   npx ts-node src/scripts/generateOneFav.ts --out tmp-daily-1.json --images 2 --size 14 --profile daily --recent tmp-recent.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateDailyPuzzle, generateLargestImageCluePuzzle } from './generators/puzzlesGenerator';
import { readRecentDailyContent } from './utils/recentDailyContent';
import { Difficulty } from '../types';

/** Clue difficulty target (1 easy … 3 hard) and how hard the fill leans toward words at that level. */
const DIFFICULTY_TUNING: Partial<
  Record<Difficulty, { targetDifficulty: number; wordDifficultyWeight: number }>
> = {
  [Difficulty.EASY]: { targetDifficulty: 1, wordDifficultyWeight: 1.5 },
  [Difficulty.MEDIUM]: { targetDifficulty: 1.8, wordDifficultyWeight: 1 },
  [Difficulty.HARD]: { targetDifficulty: 3, wordDifficultyWeight: 5 },
};
import {
  ImageClueCatalogEntry,
  loadGeneratedImageClueCatalog,
} from './generators/imageClueCatalog';
import { getUncoveredCells } from './generators/direction-utils';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { Puzzle as GeneratedPuzzle } from './core/types';
import { GridSize, IMAGE_CLUE_SIZE_LADDER } from './utils/gridSizes';

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function puzzleIsReady(puzzle: GeneratedPuzzle, minImages: number, minSize: number): boolean {
  const images = puzzle.puzzleItems.filter((item) => item.clueType === 'image');
  return (
    images.length >= minImages &&
    puzzle.grid?.rows >= minSize &&
    puzzle.grid?.cols >= minSize &&
    getUncoveredCells(puzzle).length === 0 &&
    validatePuzzleBoundaries(puzzle).length === 0 &&
    images.every((item) => item.imageUrl && item.answer && /[\u0590-\u05FF]/.test(item.answer))
  );
}

function loadCatalog(catalogPath?: string): ImageClueCatalogEntry[] {
  if (catalogPath && fs.existsSync(catalogPath)) {
    return JSON.parse(fs.readFileSync(catalogPath, 'utf8')) as ImageClueCatalogEntry[];
  }
  return loadGeneratedImageClueCatalog();
}

function main() {
  const out = arg('--out');
  const images = parseInt(arg('--images', '2') ?? '2', 10);
  const attempts = parseInt(arg('--attempts', '64') ?? '64', 10);
  const catalogPath = arg('--catalog');
  const index = parseInt(arg('--index', '1') ?? '1', 10);
  const sizeArg = parseInt(arg('--size', '15') ?? '15', 10);
  if (!out) {
    console.error('Missing --out');
    process.exit(1);
  }

  const sizes: GridSize[] =
    sizeArg >= 13
      ? [{ rows: sizeArg, cols: sizeArg }]
      : IMAGE_CLUE_SIZE_LADDER;

  const profile = arg('--profile', 'legacy');
  const catalog = loadCatalog(catalogPath);
  console.log(
    `[fav ${index}] ${profile} profile, catalog ${catalog.length}, ${images} image(s), ` +
      `${attempts} attempts, ${sizes[0].rows}x${sizes[0].cols}`
  );
  let puzzle: GeneratedPuzzle | null;
  if (profile === 'daily') {
    const recent = readRecentDailyContent(arg('--recent'));
    const difficulty = arg('--difficulty') as Difficulty | undefined;
    const tuning = difficulty ? DIFFICULTY_TUNING[difficulty] : undefined;
    if (difficulty && !tuning) {
      console.error(`Unknown --difficulty ${difficulty}; use easy, medium or hard`);
      process.exit(1);
    }
    puzzle = generateDailyPuzzle({
      rows: sizes[0].rows,
      cols: sizes[0].cols,
      title: `תשחץ יומי ${index}`,
      category: arg('--category', 'יומי') ?? 'יומי',
      imageClueCount: images,
      imageClueCatalog: catalog,
      avoidAnswers: recent.answers,
      avoidClues: recent.clues,
      ...(tuning && difficulty ? { ...tuning, difficulty } : {}),
    });
  } else {
    puzzle = generateLargestImageCluePuzzle({
      category: 'כללי',
      startIndex: index,
      imageClueCount: images,
      imageClueCatalog: catalog,
      imageClueAttempts: attempts,
      sizes,
    });
  }

  if (!puzzle || !puzzleIsReady(puzzle, images, sizeArg >= 13 ? sizeArg : 13)) {
    console.error(`[fav ${index}] FAILED`);
    process.exit(1);
  }

  const dir = path.dirname(out);
  if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(out, JSON.stringify(puzzle, null, 2));
  const imageItems = puzzle.puzzleItems.filter((item) => item.clueType === 'image');
  console.log(
    `[fav ${index}] OK ${puzzle.grid.rows}x${puzzle.grid.cols} clues=${puzzle.puzzleItems.length} images=${imageItems.length} → ${out}`
  );
}

main();
