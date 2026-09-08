import { Difficulty, Language } from '../../types';
import { Puzzle, GridTemplate } from '../core/types';
import { getClueProvider, ClueProvider } from '../core/clueProvider';
import { generateTemplate } from './template-generator';
import { solveGrid } from './grid-solver';
import { buildCrossingIndex, CrossingIndex } from './word-index';
import { generatePuzzleFromGrid } from './puzzle-assembler';
import { getSlotCells, getUncoveredCells } from './direction-utils';
import { normalizeWord } from './validation-utils';
import { createEmptyGridState, canPlaceWord, placeWord } from './grid-state';
import { GridSize, IMAGE_CLUE_COUNT_LADDER, IMAGE_CLUE_SIZE_LADDER, MAX_GRID_SIZE, MIN_GRID_SIZE, sizeFallbackChain } from '../utils/gridSizes';
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
import {
  formatQuality,
  puzzleQualityOk,
  scorePuzzle,
  scoreTemplate,
  shuffled,
  templateQualityOk,
} from './puzzle-quality';

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
    const hebrewFloor = this.language === 'he' ? MIN_GRID_SIZE : 8;
    const defaultRows = Math.min(Math.max(config.rows ?? hebrewFloor, hebrewFloor), MAX_GRID_SIZE);
    const defaultCols = Math.min(Math.max(config.cols ?? hebrewFloor, hebrewFloor), MAX_GRID_SIZE);
    const puzzles: Puzzle[] = [];

    for (let i = 0; i < config.count; i++) {
      const raw = config.sizes?.[i % (config.sizes?.length ?? 1)] ?? {
        rows: defaultRows,
        cols: defaultCols,
      };
      const requested =
        this.language === 'he'
          ? {
              rows: Math.max(MIN_GRID_SIZE, Math.min(raw.rows, MAX_GRID_SIZE)),
              cols: Math.max(MIN_GRID_SIZE, Math.min(raw.cols, MAX_GRID_SIZE)),
            }
          : {
              rows: Math.min(raw.rows, MAX_GRID_SIZE),
              cols: Math.min(raw.cols, MAX_GRID_SIZE),
            };
      const chain =
        this.language === 'he' && !config.strictSize
          ? sizeFallbackChain(requested.rows, requested.cols)
          : [requested];

      let generated: Puzzle | null = null;
      for (const size of chain) {
        const attempts = config.imageClueCount
          ? (config.imageClueAttempts ?? 48)
          : config.strictSize
            ? 28
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
          ? 24
          : cells >= 169
            ? 28
            : cells >= 144
              ? 24
              : 20
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
        wantImages > 0
          ? planImageClues(rows, cols, wantImages, this.catalogPreferredLengths())
          : [];
      if (wantImages > 0 && imagePlan.length < wantImages) {
        if (attempt < 3) {
          console.log(
            `   … image attempt ${attempt + 1}: only placed ${imagePlan.length}/${wantImages} blocks`
          );
        }
        continue;
      }
      const imageDirs = new Set(imagePlan.map((img) => img.direction));
      if (wantImages >= 2 && imageDirs.size < 2) {
        continue;
      }

      const cutoutCells =
        imagePlan.length > 0 ? imageBlockCutouts(imagePlan) : undefined;
      const imageLocks = imagePlan.length > 0 ? imageExitLocks(imagePlan) : [];
      const cornerLock = wantImages
        ? ([{ row: 0, col: 0, type: '1' as const }] as const)
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
      const bindTries = wantImages > 0 ? 4 : 1;
      for (let bindTry = 0; bindTry < bindTries; bindTry++) {
        if (bindTry > 0) this.clearImageBinds(template);
        if (!this.bindImageClues(template, imagePlan, this.imageClueCatalog)) {
          if (wantImages > 0 && attempt < 8 && bindTry === 0) {
            const wanted = imagePlan
              .map((img) => `${img.direction}:${img.answerLength}@(${img.exitRow},${img.exitCol})`)
              .join(' ');
            console.log(
              `   … image attempt ${attempt + 1}: bind failed (${template.slots.length} slots, wanted ${wanted}, ${Date.now() - t0}ms)`
            );
          }
          continue;
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
            continue;
          }
        }

        const maxLen = wantImages > 0 ? 9 : 11;
        if (template.slots.some((slot) => slot.length > maxLen || slot.length < 3)) {
          if (wantImages > 0 && attempt < 8 && bindTry === 0) {
            const bad = template.slots.filter((slot) => slot.length > maxLen || slot.length < 3);
            console.log(
              `   … image attempt ${attempt + 1}: unfillable slot lengths ${bad.map((s) => s.length).join(',')}`
            );
          }
          continue;
        }

        const templateStats = scoreTemplate(template);
        if (this.language === 'he' && !templateQualityOk(templateStats, wantImages)) {
          if (attempt < 8 && bindTry === 0) {
            console.log(
              `   … attempt ${attempt + 1}: template quality ${formatQuality(templateStats)}`
            );
          }
          break;
        }

        if (wantImages > 0 && bindTry === 0) {
          const images = template.slots
            .filter((slot) => slot.clueType === 'image')
            .map((slot) => `${slot.direction}:${slot.length}`)
            .join(',');
          console.log(
            `   … image attempt ${attempt + 1}: solving ${template.slots.length} slots [${images}] (${Date.now() - t0}ms tmpl) ${formatQuality(templateStats)}`
          );
        }
        const solveTries = wantImages > 0 ? 3 : this.language === 'he' ? 2 : 1;
        for (let solveTry = 0; solveTry < solveTries && !puzzle; solveTry++) {
          puzzle = this.solveTemplate(template, meta);
        }
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
      const stats = scorePuzzle(puzzle);
      if (this.language === 'he' && !puzzleQualityOk(stats, wantImages)) {
        if (attempt < 8) {
          console.log(
            `   … attempt ${attempt + 1}: filled but quality ${formatQuality(stats)}`
          );
        }
        continue;
      }
      if (this.language === 'he') {
        console.log(`   quality ${formatQuality(stats)}`);
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

  private catalogPreferredLengths(): number[] {
    const counts = new Map<number, number>();
    for (const entry of this.imageClueCatalog) {
      const len = catalogLetterLength(entry);
      counts.set(len, (counts.get(len) ?? 0) + 1);
    }
    const preferred = [...counts.entries()]
      .filter(([len, n]) => len >= 5 && len <= 9 && n >= 6)
      .sort((a, b) => b[1] - a[1])
      .map(([len]) => len);
    return preferred.length > 0 ? preferred : [8, 7, 6, 9, 5];
  }

  private bindImageClues(
    template: GridTemplate,
    imagePlan: PlannedImageClue[],
    catalog: ImageClueCatalogEntry[]
  ): boolean {
    if (imagePlan.length === 0) return true;

    const usedSlots = new Set<string>();
    for (const img of imagePlan) {
      const slot =
        template.slots.find(
          (s) =>
            !usedSlots.has(s.id) &&
            s.startRow === img.exitRow &&
            s.startCol === img.exitCol &&
            s.direction === img.direction &&
            s.length >= 5 &&
            s.length <= 9
        ) ??
        template.slots.find(
          (s) =>
            !usedSlots.has(s.id) &&
            s.startRow === img.exitRow &&
            s.startCol === img.exitCol &&
            s.length >= 5 &&
            s.length <= 9
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
        direction: slot.direction,
      });
      if (
        fromExit.length < 3 ||
        fromExit.some((cell) => isInImageBlock(cell.row, cell.col, img.startRow, img.startCol))
      ) {
        return false;
      }

      const entries = shuffled(
        catalog.filter((entry) => catalogLetterLength(entry) === slot.length)
      );
      if (entries.length < 4) {
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
    const dummy = (length: number) => 'א'.repeat(length);
    let filled = probe;
    const orderedSlots = [
      ...template.slots.filter((slot) => slot.clueType === 'image'),
      ...template.slots.filter((slot) => slot.clueType !== 'image'),
    ];
    for (const slot of orderedSlots) {
      const cells = getSlotCells(slot);
      const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
      const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;
      const word = dummy(slot.length);
      if (!canPlaceWord(filled, word, cells, rowDelta, colDelta)) {
        return false;
      }
      filled = placeWord(filled, slot.id, word, cells, rowDelta, colDelta);
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
        maxIterations: this.language === 'he' ? (withImages ? (large ? 40 : 32) : large ? 36 : 28) : 8,
        minPopulation: 4,
        populationSize: this.language === 'he' ? (withImages ? 12 : large ? 12 : 10) : 5,
        weakBreakCondition: this.language === 'he' ? (withImages ? 400 : large ? 420 : 320) : 80,
        strongBreakCondition: this.language === 'he' ? (withImages ? 900 : large ? 950 : 700) : 250,
        maxBoundaryRetries: withImages ? 4 : 3,
        maxSlotLength: this.language === 'he' ? (withImages ? 9 : 11) : undefined,
        sparse: false,
        simpleArrows: false,
        lattice: false,
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
      ? 45000
      : (this.language === 'he' ? 28 : 12) * 1000 + cells * (cells >= 256 ? 80 : 40);
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
      maxTextSliceMs: hasImages ? 20000 : undefined,
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

/** Try 15×15 → 13×13 with mixed-arrow image clues. */
export function generateLargestImageCluePuzzle(config: {
  category: string;
  startIndex: number;
  imageClueCount?: number;
  imageClueCatalog: ImageClueCatalogEntry[];
  imageClueAttempts?: number;
  sizes?: GridSize[];
}): Puzzle | null {
  const generator = new PuzzleGenerator('he', config.imageClueCatalog);
  const counts = config.imageClueCount
    ? [config.imageClueCount]
    : IMAGE_CLUE_COUNT_LADDER;
  const sizes = config.sizes ?? IMAGE_CLUE_SIZE_LADDER;
  for (const size of sizes) {
    for (const imageCount of counts) {
      const attempts = config.imageClueAttempts ?? (imageCount >= 4 ? 64 : 48);
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
