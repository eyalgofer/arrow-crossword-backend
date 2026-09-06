import { Difficulty, Language } from '../../types';
import { Puzzle, GridTemplate } from '../core/types';
import { getClueProvider, ClueProvider } from '../core/clueProvider';
import { generateTemplate } from './template-generator';
import { solveGrid } from './grid-solver';
import { buildCrossingIndex, CrossingIndex } from './word-index';
import { generatePuzzleFromGrid } from './puzzle-assembler';
import { GridSize, MAX_GRID_SIZE, sizeFallbackChain } from '../utils/gridSizes';
import {
  imageBlockCutouts,
  imageExitLocks,
  planImageClues,
  PlannedImageClue,
} from './imageClueCatalog';

export class PuzzleGenerator {
  private wordIndex: CrossingIndex;
  private language: Language;
  private clueProvider: ClueProvider;

  constructor(language: Language = 'en') {
    this.language = language;
    this.clueProvider = getClueProvider(language);

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
          ? 20
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
      const lockedCells =
        imagePlan.length > 0 ? imageExitLocks(imagePlan) : undefined;

      const t0 = Date.now();
      const template = this.buildTemplate(rows, cols, cutoutCells, lockedCells);
      if (!template) {
        if (wantImages > 0 && attempt < 5) {
          console.log(
            `   … image attempt ${attempt + 1}: template failed (${Date.now() - t0}ms)`
          );
        }
        continue;
      }

      if (!this.bindImageClues(template, imagePlan)) {
        if (wantImages > 0 && attempt < 5) {
          console.log(
            `   … image attempt ${attempt + 1}: bind failed (${template.slots.length} slots, ${Date.now() - t0}ms)`
          );
        }
        continue;
      }

      if (template.slots.some((slot) => slot.length > 13 || slot.length < 3)) {
        continue;
      }

      if (wantImages > 0) {
        console.log(
          `   … image attempt ${attempt + 1}: solving ${template.slots.length} slots (${Date.now() - t0}ms tmpl)...`
        );
      }
      const puzzle = this.solveTemplate(template, meta);
      if (!puzzle) {
        if (wantImages > 0 && attempt < 8) {
          console.log(`   … image attempt ${attempt + 1}: solve/validate failed`);
        }
        continue;
      }
      return puzzle;
    }
    return null;
  }

  private bindImageClues(
    template: GridTemplate,
    imagePlan: PlannedImageClue[]
  ): boolean {
    if (imagePlan.length === 0) return true;

    const used = new Set<string>();
    for (const img of imagePlan) {
      let slot = template.slots.find(
        (s) =>
          !used.has(s.id) &&
          s.startRow === img.exitRow &&
          s.startCol === img.exitCol &&
          s.direction === img.direction &&
          s.length >= 3
      );
      // Fallback: any ≥3 slot anchored on the exit cell
      if (!slot) {
        slot = template.slots.find(
          (s) =>
            !used.has(s.id) &&
            s.startRow === img.exitRow &&
            s.startCol === img.exitCol &&
            s.length >= 3
        );
      }
      if (!slot) return false;

      used.add(slot.id);
      slot.clueType = 'image';
      slot.imageUrl = img.imageUrl;
      slot.exitRow = img.exitRow;
      slot.exitCol = img.exitCol;
      slot.startRow = img.startRow;
      slot.startCol = img.startCol;
      // Keep slot.direction from the template (matches the locked field type)
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
        maxIterations: this.language === 'he'
          ? withImages
            ? large
              ? 10
              : 8
            : large
              ? 22
              : 18
          : 8,
        minPopulation: 3,
        populationSize: this.language === 'he'
          ? withImages
            ? 4
            : large
              ? 8
              : 6
          : 5,
        weakBreakCondition: this.language === 'he'
          ? withImages
            ? 40
            : large
              ? 180
              : 130
          : 80,
        strongBreakCondition: this.language === 'he'
          ? withImages
            ? 100
            : large
              ? 450
              : 350
          : 250,
        // Image boards: a little uncovered slack helps the GA around cutouts
        sparse: this.language === 'he' && (cells >= 81 || withImages),
        cutoutCells,
        lockedCells,
      });
    } catch {
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
    const maxSolveTimeMs =
      (this.language === 'he' ? 20 : 12) * 1000 + cells * 60;

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

    const result = solveGrid(template, this.wordIndex, {
      maxAttempts,
      maxSolveTimeMs,
      wordScorer,
      quiet: true,
    });
    if (!result) return null;

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
}): Puzzle[] {
  const language = config.language ?? 'en';
  const generator = new PuzzleGenerator(language);
  return generator.generateBatch({
    count: config.count,
    category: config.category,
    getTitle: (i) => `${config.startIndex + i}`,
    rows: config.rows,
    cols: config.cols,
    sizes: config.sizes,
    strictSize: config.strictSize,
    imageClueCount: config.imageClueCount,
  });
}
