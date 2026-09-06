/**
 * Generate the largest Hebrew image-clue puzzle that will fill, and write it to disk.
 * Usage: npx ts-node src/scripts/generateImageCluePuzzle.ts
 */
import { generateLargestImageCluePuzzle } from './generators/puzzlesGenerator';
import { loadGeneratedImageClueCatalog } from './generators/imageClueCatalog';
import { getUncoveredCells } from './generators/direction-utils';
import { validatePuzzleBoundaries } from './validatePuzzleBoundaries';
import * as fs from 'fs';
import * as path from 'path';

const OUT = path.join(__dirname, '../../tmp-image-clue-puzzle.json');

async function main() {
  const catalog = loadGeneratedImageClueCatalog();
  if (catalog.length < 1) {
    console.error(
      `Need processed image clues, found ${catalog.length}. ` +
        `Run scripts/arrow-image-pipeline \`npm run process\` first.`
    );
    process.exit(1);
  }

  console.log(
    `Generating 17x17 with 2 image clues and no empty cells (catalog ${catalog.length})...`
  );
  const t0 = Date.now();
  const p = generateLargestImageCluePuzzle({
    category: 'כללי',
    startIndex: 9,
    imageClueCount: 2,
    imageClueCatalog: catalog,
  });
  console.log(`elapsed ${Date.now() - t0}ms`);

  if (!p) {
    console.error('NO PUZZLE');
    process.exit(1);
  }

  const errs = validatePuzzleBoundaries(p);
  if (errs.length) {
    console.error('Boundary errors:', errs);
    process.exit(1);
  }

  const empty = getUncoveredCells(p);
  if (empty.length) {
    console.error(`Empty cells (${empty.length}):`, empty.slice(0, 8));
    process.exit(1);
  }

  const images = p.puzzleItems.filter((i) => i.clueType === 'image');
  console.log(
    `OK ${p.grid.rows}x${p.grid.cols} clues=${p.puzzleItems.length} images=${images.length}`
  );
  for (const img of images) {
    console.log(
      `  #${img.number} ${img.direction} ${img.answer} block(${img.startRow},${img.startCol}) exit(${img.exitRow},${img.exitCol})` +
        (img.imageUrl ? `\n    ${img.imageUrl}` : '')
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
