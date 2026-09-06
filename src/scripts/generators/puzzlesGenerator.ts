import { Difficulty, Language } from '../../types';
import { Puzzle, GridTemplate, Direction } from '../core/types';
import { getClueProvider, ClueProvider } from '../core/clueProvider';
import { generateTemplate } from './template-generator';
import { solveGrid } from './grid-solver';
import { buildCrossingIndex, CrossingIndex } from './word-index';
import { generatePuzzleFromGrid } from './puzzle-assembler';
import { getSlotCells, getUncoveredCells } from './direction-utils';
import { normalizeWord } from './validation-utils';
import { createEmptyGridState, canPlaceWord } from './grid-state';
import { GridSize, IMAGE_CLUE_COUNT_LADDER, IMAGE_CLUE_SIZE_LADDER, MAX_GRID_SIZE, sizeFallbackChain } from '../utils/gridSizes';
import {
  catalogLetterLength,
  imageBlockCutouts,
  imageExitLocks,
  isInImageBlock,
  ImageClueCatalogEntry,
  loadGeneratedImageClueCatalog,
  planImageClues,
  PlannedImageClue,
} from './imageClueCatalog';

const HORIZONTAL_DIRS = new Set<Direction>(['across', 'down-across', 'up-across']);

function directionMixOk(
  slots: Array<{ direction: Direction }>,
  logLabel?: string
): boolean {
  let horizontal = 0;
  let vertical = 0;
  const kinds = new Set<Direction>();
  for (const slot of slots) {
    kinds.add(slot.direction);
    if (HORIZONTAL_DIRS.has(slot.direction)) horizontal += 1;
    else vertical += 1;
  }
  const total = horizontal + vertical;
  if (total === 0) return false;
  const hShare = horizontal / total;
  const vShare = vertical / total;
  const ok = hShare >= 0.32 && vShare >= 0.32 && kinds.size >= 2;
  if (!ok && logLabel) {
    console.log(
      `   … ${logLabel}: direction mix h=${horizontal} v=${vertical} kinds=${[...kinds].join(',')}`
    );
  }
  return ok;
}

export class PuzzleGenerator {
  private wordIndex: CrossingIndex;
  private language: Language;
  private clueProvider: ClueProvider;
  private imageClueCatalog: ImageClueCatalogEntry[];

  constructor(
    language: Language = 'en',
    imageClueCatalog?: ImageClueCatalogEntry[]
  ) {
    this.language = language;
    this.clueProvider = getClueProvider(language);
    this.imageClueCatalog = imageClueCatalog ?? loadGeneratedImageClueCatalog();

    const words = this.clueProvider.getWordPool();
    if (words.length === 0) {
      throw new Error(
        `(${language}) is empty. Check that ` +
          `the clue database sources exist in src/scripts/core.`
      );
    }
    this.wordIndex = buildCrossingIndex(words);
  }

  generateBatch(config: {
    count: number;
    category: string;
    getTitle: (index: number) => string;
    rows?: number;
    cols?: number;
    sizes?: GridSize[];
    strictSize?: boolean;
    imageClueCount?: number;
    imageClueAttempts?: number;
  }): Puzzle[] {
    const defaultRows = Math.min(config.rows ?? 12, MAX_GRID_SIZE);
    const defaultCols = Math.min(config.cols ?? 12, MAX_GRID_SIZE);
    const puzzles: Puzzle[] = [];

    for (let i = 0; i < config.count; i++) {
      const requested = config.sizes?.[i % (config.sizes?.length ?? 1)] ?? {
        rows: defaultRows,
        cols: defaultCols,
      };
      const chain =
        this.language === 'he' && !config.strictSize
          ? sizeFallbackChain(requested.rows, requested.cols)
          : [
              {
                rows: Math.min(requested.rows, MAX_GRID_SIZE),
                cols: Math.min(requested.cols, MAX_GRID_SIZE),
              },
            ];

      let generated: Puzzle | null = null;
      for (const size of chain) {
        const attempts = config.imageClueCount
          ? (config.imageClueAttempts ?? 40)
          : config.strictSize
            ? 24
            : undefined;
        generated = this.tryGenerateOne(
          size.rows,
          size.cols,
          {
            title: config.getTitle(puzzles.length),
            category: config.category,
            imageClueCount: config.imageClueCount,
          },
          attempts
        );
        if (generated) {
          if (size.rows !== requested.rows || size.cols !== requested.cols) {
            console.log(
              `   ↘️  ${requested.rows}x${requested.cols} too tight, using ${size.rows}x${size.cols}`
            );
          }
          break;
        }
        if (chain.length > 1) {
          console.log(
            `   … ${size.rows}x${size.cols} did not fill, trying a smaller grid`
          );
        }
      }

      if (generated) {
        puzzles.push(generated);
        const images = generated.puzzleItems.filter((p) => p.clueType === 'image').length;
        console.log(
          `✅ Puzzle ${puzzles.length}/${config.count}: ${generated.puzzleItems.length} clues ` +
            `(${generated.grid.rows}x${generated.grid.cols}` +
            (images ? `, ${images} images` : '') +
            `)`
        );
      }
    }

    if (puzzles.length < config.count) {
      console.warn(`⚠️  Generated ${puzzles.length}/${config.count} puzzles`);
    }
    return puzzles;
  }

  private tryGenerateOne(
    rows: number,
    cols: number,
    meta: { title: string; category: string; imageClueCount?: number },
    attemptOverride?: number
  ): Puzzle | null {
    const cells = rows * cols;
    const attempts =
      attemptOverride ??
      (this.language === 'he'
        ? cells >= 196
          ? 16
          : cells >= 144
            ? 18
            : cells >= 121
              ? 16
              : cells >= 100
                ? 14
                : 12
        : 15);

    // Image clues: Hebrew only, and only when explicitly requested.
    const wantImages =
      this.language === 'he' ? (meta.imageClueCount ?? 0) : 0;
    if (wantImages > 0 && this.imageClueCatalog.length < wantImages) {
      console.error(
        `Image-clue catalog has ${this.imageClueCatalog.length} entries, need ${wantImages}. ` +
          `Run scripts/arrow-image-pipeline \`npm run process\` first.`
      );
      return null;
    }

    for (let attempt = 0; attempt < attempts; attempt++) {
      const imagePlan =
        wantImages > 0 ? planImageClues(rows, cols, wantImages) : [];
      if (wantImages > 0 && imagePlan.length < wantImages) {
        if (attempt < 3) {
          console.log(
            `   … image attempt ${attempt + 1}: only placed ${imagePlan.length}/${wantImages} blocks`
          );
        }
        continue;
      }

      const cutoutCells =
        imagePlan.length > 0 ? imageBlockCutouts(imagePlan) : undefined;
      const imageLocks = imagePlan.length > 0 ? imageExitLocks(imagePlan) : [];
      const cornerLock = wantImages
        ? ([
            { row: 0, col: 0, type: '1' as const },
            { row: 0, col: 1, type: '0' as const },
            { row: 0, col: 2, type: '0' as const },
            { row: 0, col: 3, type: '0' as const },
          ] as const)
        : [];
      const lockedCells = [...cornerLock, ...imageLocks];
      const protectedCells = [...cornerLock, ...imageLocks];

      const t0 = Date.now();
      const template = this.buildTemplate(
        rows,
        cols,
        cutoutCells,
        lockedCells.length ? lockedCells : undefined,
        protectedCells.length ? protectedCells : undefined
      );
      if (!template) {
        if (wantImages > 0 && attempt < 8) {
          console.log(
            `   … image attempt ${attempt + 1}: template failed (${Date.now() - t0}ms)`
          );
        }
        continue;
      }

      let puzzle: Puzzle | null = null;
      const bindTries = 1;
      for (let bindTry = 0; bindTry < bindTries; bindTry++) {
        if (bindTry > 0) this.clearImageBinds(template);
        if (!this.bindImageClues(template, imagePlan, this.imageClueCatalog)) {
          if (wantImages > 0 && attempt < 5 && bindTry === 0) {
            console.log(
              `   … image attempt ${attempt + 1}: bind failed (${template.slots.length} slots, ${Date.now() - t0}ms)`
            );
          }
          break;
        }

        if (wantImages > 0) {
          const covered = new Set<string>();
          for (const clue of template.clueCells) covered.add(`${clue.row},${clue.col}`);
          for (const slot of template.slots) {
            for (const cell of getSlotCells(slot)) covered.add(`${cell.row},${cell.col}`);
          }
          for (const cut of cutoutCells ?? []) covered.add(`${cut.row},${cut.col}`);
          const holes = rows * cols - covered.size;
          if (holes > 0) {
            if (attempt < 8 && bindTry === 0) {
              console.log(`   … image attempt ${attempt + 1}: ${holes} empty cells, retrying`);
            }
            break;
          }
        }

        if (template.slots.some((slot) => slot.length > 11 || slot.length < 3)) {
          if (wantImages > 0 && attempt < 8 && bindTry === 0) {
            const bad = template.slots.filter((slot) => slot.length > 11 || slot.length < 3);
            console.log(
              `   … image attempt ${attempt + 1}: unfillable slot lengths ${bad.map((s) => s.length).join(',')}`
            );
          }
          break;
        }

        if (wantImages > 0 && !directionMixOk(template.slots, bindTry === 0 ? `image attempt ${attempt + 1}` : undefined)) {
          break;
        }

        if (wantImages > 0 && bindTry === 0) {
          console.log(
            `   … image attempt ${attempt + 1}: solving ${template.slots.length} slots (${Date.now() - t0}ms tmpl)...`
          );
        }
        puzzle = this.solveTemplate(template, meta);
        if (puzzle) break;
      }
      if (!puzzle) {
        if (wantImages > 0) {
          console.log(`   … image attempt ${attempt + 1}: solve/validate failed`);
        }
        continue;
      }
      const empty = getUncoveredCells(puzzle);
      if (empty.length > 0) {
        if (wantImages > 0 && attempt < 8) {
          console.log(
            `   … image attempt ${attempt + 1}: puzzle has ${empty.length} empty cells`
          );
        }
        continue;
      }
      if (wantImages > 0 && !directionMixOk(puzzle.puzzleItems, `image attempt ${attempt + 1} solved`)) {
        continue;
      }
      return puzzle;
    }
    return null;
  }

  private clearImageBinds(template: GridTemplate): void {
    for (const slot of template.slots) {
      if (slot.clueType !== 'image') continue;
      if (slot.exitRow != null) slot.startRow = slot.exitRow;
      if (slot.exitCol != null) slot.startCol = slot.exitCol;
      delete slot.clueType;
      delete slot.imageUrl;
      delete slot.fixedAnswer;
      delete slot.fixedEnumeration;
      delete slot.candidateAnswers;
      delete slot.imageUrlByAnswer;
      delete slot.exitRow;
      delete slot.exitCol;
    }
  }

  private bindImageClues(
    template: GridTemplate,
    imagePlan: PlannedImageClue[],
    catalog: ImageClueCatalogEntry[]
  ): boolean {
    if (imagePlan.length === 0) return true;

    const usedSlots = new Set<string>();
    for (const img of imagePlan) {
      const slot = template.slots.find(
        (s) =>
          !usedSlots.has(s.id) &&
          s.startRow === img.exitRow &&
          s.startCol === img.exitCol &&
          s.direction === img.direction &&
          s.length >= 3
      );
      if (!slot) return false;

      const fromExit = getSlotCells({
        ...slot,
        cells: undefined,
        clueType: 'image',
        exitRow: img.exitRow,
        exitCol: img.exitCol,
        startRow: img.exitRow,
        startCol: img.exitCol,
      });
      if (
        fromExit.length < 3 ||
        fromExit.some((cell) => isInImageBlock(cell.row, cell.col, img.startRow, img.startCol))
      ) {
        return false;
      }

      const entries = catalog.filter((entry) => catalogLetterLength(entry) === slot.length);
      if (entries.length === 0) {
        console.log(`   … no image answer of length ${slot.length}`);
        return false;
      }

      const rowDelta = fromExit.length >= 2 ? fromExit[1].row - fromExit[0].row : 0;
      const colDelta = fromExit.length >= 2 ? fromExit[1].col - fromExit[0].col : 0;
      const probe = createEmptyGridState(template.rows, template.cols);
      for (const clue of template.clueCells) {
        probe.clueCells.add(`${clue.row},${clue.col}`);
      }
      for (const block of imagePlan) {
        probe.clueCells.add(`${block.exitRow},${block.exitCol}`);
        for (let dr = 0; dr < 3; dr++) {
          for (let dc = 0; dc < 3; dc++) {
            const row = block.startRow + dr;
            const col = block.startCol + dc;
            if (row === block.exitRow && col === block.exitCol) continue;
            probe.clueCells.add(`${row},${col}`);
          }
        }
      }
      if (!entries.some((entry) => canPlaceWord(probe, entry.answer, fromExit, rowDelta, colDelta))) {
        return false;
      }

      const imageUrlByAnswer: Record<string, string> = {};
      for (const entry of entries) {
        imageUrlByAnswer[entry.answer] = entry.imageUrl;
        imageUrlByAnswer[normalizeWord(entry.answer)] = entry.imageUrl;
      }

      usedSlots.add(slot.id);
      slot.cells = fromExit;
      slot.clueType = 'image';
      slot.exitRow = img.exitRow;
      slot.exitCol = img.exitCol;
      slot.startRow = img.startRow;
      slot.startCol = img.startCol;
      slot.candidateAnswers = entries.map((entry) => entry.answer);
      slot.imageUrlByAnswer = imageUrlByAnswer;
      delete slot.fixedAnswer;
      delete slot.imageUrl;
    }

    const probe = createEmptyGridState(template.rows, template.cols);
    for (const clue of template.clueCells) {
      probe.clueCells.add(`${clue.row},${clue.col}`);
    }
    for (const slot of template.slots) {
      if (slot.clueType !== 'image') continue;
      if (slot.exitRow != null) probe.clueCells.add(`${slot.exitRow},${slot.exitCol}`);
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          probe.clueCells.add(`${slot.startRow + dr},${slot.startCol + dc}`);
        }
      }
    }
    for (const slot of template.slots) {
      const cells = getSlotCells(slot);
      if (
        cells.some(
          (cell) =>
            cell.row < 0 ||
            cell.col < 0 ||
            cell.row >= template.rows ||
            cell.col >= template.cols ||
            probe.clueCells.has(`${cell.row},${cell.col}`)
        )
      ) {
        return false;
      }
    }
    return true;
  }

  private buildTemplate(
    rows: number,
    cols: number,
    cutoutCells?: Array<{ row: number; col: number }>,
    lockedCells?: Array<{
      row: number;
      col: number;
      type: '0' | '1' | '2' | '3' | '4' | '5' | '6';
    }>,
    protectedCells?: Array<{
      row: number;
      col: number;
      type: '0' | '1' | '2' | '3' | '4' | '5' | '6';
    }>
  ): GridTemplate | null {
    const cells = rows * cols;
    const large = cells >= 144;
    const withImages = (cutoutCells?.length ?? 0) > 0;
    try {
      return generateTemplate({
        rows,
        cols,
        name: `${rows}x${cols} arrow crossword`,
        quiet: true,
        maxIterations: this.language === 'he' ? (large ? 22 : 18) : 8,
        minPopulation: 3,
        populationSize: this.language === 'he' ? (large ? 8 : 6) : 5,
        weakBreakCondition: this.language === 'he' ? (large ? 180 : 130) : 80,
        strongBreakCondition: this.language === 'he' ? (large ? 450 : 350) : 250,
        maxBoundaryRetries: 2,
        maxSlotLength: this.language === 'he' ? 11 : undefined,
        sparse: this.language === 'he' && cells >= 81 && !withImages,
        simpleArrows: withImages,
        cutoutCells,
        lockedCells,
        protectedCells,
      });
    } catch (error) {
      if (withImages) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`   … template error: ${message.slice(0, 120)}`);
      }
      return null;
    }
  }

  private solveTemplate(
    template: GridTemplate,
    config: { title: string; category: string }
  ): Puzzle | null {
    const slotCount = template.slots.length;
    const maxAttempts = Math.min(80000 + slotCount * 5000, 300000);
    const cells = template.rows * template.cols;
    const hasImages = template.slots.some((slot) => slot.clueType === 'image');
    const maxSolveTimeMs = hasImages
      ? 180000
      : (this.language === 'he' ? 20 : 12) * 1000 + cells * (cells >= 256 ? 80 : 40);
    const jitter = new Map<string, number>();
    const wordScorer = (word: string, _placedWords: string[]) => {
      let j = jitter.get(word);
      if (j === undefined) {
        j = Math.random();
        jitter.set(word, j);
      }
      const rank = this.clueProvider.getAnswerRank(word);
      return -Math.log(Math.max(rank, 1)) + j;
    };

    const tSolve = Date.now();
    const result = solveGrid(template, this.wordIndex, {
      maxAttempts,
      maxSolveTimeMs,
      wordScorer,
      quiet: true,
    });
    if (!result) {
      if (hasImages) {
        console.log(`   … solver empty after ${Date.now() - tSolve}ms`);
      }
      return null;
    }

    try {
      return generatePuzzleFromGrid(template, result, {
        title: config.title,
        category: config.category,
        language: this.language,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('validation failed')) {
        console.error(`  ❌ ${error.message}`);
        return null;
      }
      throw error;
    }
  }
}

export function generatePuzzlesBatch(config: {
  difficulty: Difficulty;
  count: number;
  category: string;
  startIndex: number;
  rows?: number;
  cols?: number;
  sizes?: GridSize[];
  language?: Language;
  strictSize?: boolean;
  imageClueCount?: number;
  imageClueCatalog?: ImageClueCatalogEntry[];
  imageClueAttempts?: number;
}): Puzzle[] {
  const language = config.language ?? 'en';
  const generator = new PuzzleGenerator(language, config.imageClueCatalog);
  return generator.generateBatch({
    count: config.count,
    category: config.category,
    getTitle: (i) => `${config.startIndex + i}`,
    rows: config.rows,
    cols: config.cols,
    sizes: config.sizes,
    strictSize: config.strictSize,
    imageClueCount: config.imageClueCount,
    imageClueAttempts: config.imageClueAttempts,
  });
}

/** Try 16×16 with 4 image clues, using mixed →↓ arrows. */
export function generateLargestImageCluePuzzle(config: {
  category: string;
  startIndex: number;
  imageClueCount?: number;
  imageClueCatalog: ImageClueCatalogEntry[];
}): Puzzle | null {
  const generator = new PuzzleGenerator('he', config.imageClueCatalog);
  const counts = config.imageClueCount
    ? [config.imageClueCount]
    : IMAGE_CLUE_COUNT_LADDER;
  for (const size of IMAGE_CLUE_SIZE_LADDER) {
    for (const imageCount of counts) {
      const attempts = 28;
      console.log(
        `\n—— Trying ${size.rows}x${size.cols} with ${imageCount} image${imageCount === 1 ? '' : 's'} (${attempts} attempts) ——`
      );
      const t0 = Date.now();
      const puzzles = generator.generateBatch({
        count: 1,
        category: config.category,
        getTitle: () => `${config.startIndex}`,
        rows: size.rows,
        cols: size.cols,
        strictSize: true,
        imageClueCount: imageCount,
        imageClueAttempts: attempts,
      });
      console.log(
        `   ${size.rows}x${size.cols} / ${imageCount} image(s) elapsed ${Date.now() - t0}ms`
      );
      if (puzzles[0]) return puzzles[0];
      console.log(`   did not fill, trying next`);
    }
  }
  return null;
}
