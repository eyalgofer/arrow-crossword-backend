/**
 * Generate a Hebrew image-clue puzzle and write it to disk (no DB required).
 * Usage: npx ts-node src/scripts/generateImageCluePuzzle.ts
 */
import { Difficulty } from '../types';
import { generatePuzzlesBatch } from './generators/puzzlesGenerator';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import * as fs from 'fs';
import * as path from 'path';

const ROWS = 13;
const COLS = 13;
const IMAGE_CLUE_COUNT = 3;
const OUT = path.join(__dirname, '../../tmp-image-clue-puzzle.json');

async function main() {
  console.log(`Generating Hebrew ${ROWS}x${COLS} with ${IMAGE_CLUE_COUNT} images...`);
  const t0 = Date.now();
  const puzzles = generatePuzzlesBatch({
    difficulty: Difficulty.MEDIUM,
    count: 1,
    category: 'כללי',
    startIndex: 9,
    rows: ROWS,
    cols: COLS,
    language: 'he',
    strictSize: true,
    imageClueCount: IMAGE_CLUE_COUNT,
  });
  console.log(`elapsed ${Date.now() - t0}ms`);

  if (!puzzles.length) {
    console.error('NO PUZZLE');
    process.exit(1);
  }

  const p = puzzles[0];
  const errs = validatePuzzleBoundaries(p);
  if (errs.length) {
    console.error('Boundary errors:', errs);
    process.exit(1);
  }

  const images = p.puzzleItems.filter((i) => i.clueType === 'image');
  console.log(
    `OK ${p.grid.rows}x${p.grid.cols} clues=${p.puzzleItems.length} images=${images.length}`
  );
  for (const img of images) {
    console.log(
      `  #${img.number} ${img.direction} ${img.answer} block(${img.startRow},${img.startCol}) exit(${img.exitRow},${img.exitCol})`
    );
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(p, null, 2));
  console.log('Wrote', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
