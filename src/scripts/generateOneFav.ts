/**
 * Generate one 15×15 Hebrew image-clue puzzle and write JSON to --out.
 * Used by seed:fav-puzzles in parallel.
 *
 * Usage:
 *   npx ts-node src/scripts/generateOneFav.ts --out tmp-fav-1.json --images 2 --attempts 40
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateLargestImageCluePuzzle } from './generators/puzzlesGenerator';
import {
  ImageClueCatalogEntry,
  loadGeneratedImageClueCatalog,
} from './generators/imageClueCatalog';
import { getUncoveredCells } from './generators/direction-utils';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import { Puzzle as GeneratedPuzzle } from './core/types';

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function puzzleIsReady(puzzle: GeneratedPuzzle, minImages: number): boolean {
  const images = puzzle.puzzleItems.filter((item) => item.clueType === 'image');
  return (
    images.length >= minImages &&
    puzzle.grid?.rows >= 12 &&
    puzzle.grid?.cols >= 12 &&
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
  const attempts = parseInt(arg('--attempts', '48') ?? '48', 10);
  const catalogPath = arg('--catalog');
  const index = parseInt(arg('--index', '1') ?? '1', 10);
  if (!out) {
    console.error('Missing --out');
    process.exit(1);
  }

  const catalog = loadCatalog(catalogPath);
  console.log(`[fav ${index}] catalog ${catalog.length}, ${images} image(s), ${attempts} attempts`);
  const puzzle = generateLargestImageCluePuzzle({
    category: 'כללי',
    startIndex: index,
    imageClueCount: images,
    imageClueCatalog: catalog,
    imageClueAttempts: attempts,
    sizes: [
      { rows: 12, cols: 12 },
    ],
  });

  if (!puzzle || !puzzleIsReady(puzzle, images)) {
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
