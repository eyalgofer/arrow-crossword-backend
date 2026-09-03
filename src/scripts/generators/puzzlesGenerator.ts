/**
 * The puzzle generator.
 *
 * Pipeline: curated word pool (clueDatabase) -> evolutionary template
 * (template-generator) -> CSP fill (grid-solver) -> clue assignment
 * (puzzle-assembler).
 *
 * Every word in the pool is a common English word with at least one quality
 * clue, so generated puzzles never contain obscure fill or placeholder clues.
 */

import { Difficulty, Language } from '../../types';
import { Puzzle, GridTemplate } from '../core/types';
import { getClueProvider, ClueProvider } from '../core/clueProvider';
import { generateTemplate } from './template-generator';
import { solveGrid } from './grid-solver';
import { buildCrossingIndex, CrossingIndex } from './word-index';
import { generatePuzzleFromGrid } from './puzzle-assembler';
import { GridSize, MAX_GRID_SIZE, sizeFallbackChain } from '../utils/gridSizes';
import { normalizeWord } from './validation-utils';

export class PuzzleGenerator {
  private wordIndex: CrossingIndex;
  private language: Language;
  private clueProvider: ClueProvider;

  constructor(
    language: Language = 'en',
  ) {
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

  /**
   * Generate `count` puzzles. Each puzzle gets a fresh template so grids vary.
   * Grid size is capped at 12x12. Hebrew tries the requested size, then scales down toward 8x8.
   */
  generateBatch(config: {
    count: number;
    category: string;
    getTitle: (index: number) => string;
    rows?: number;
    cols?: number;
    sizes?: GridSize[];
    /** If true, do not scale Hebrew grids down when the requested size fails. */
    strictSize?: boolean;
  }): Puzzle[] {
    const defaultRows = 13 //Math.min(config.rows ?? 8, MAX_GRID_SIZE);
    const defaultCols = 13 //Math.min(config.cols ?? 8, MAX_GRID_SIZE);
    const puzzles: Puzzle[] = [];

    for (let i = 0; i < config.count; i++) {
      const requested = config.sizes?.[i % config.sizes.length] ?? { rows: defaultRows, cols: defaultCols };
      const chain = this.language === 'he' && !config.strictSize
        ? sizeFallbackChain(requested.rows, requested.cols)
        : [{ rows: Math.min(requested.rows, MAX_GRID_SIZE), cols: Math.min(requested.cols, MAX_GRID_SIZE) }];

      let generated: Puzzle | null = null;
      for (const size of chain) {
        generated = this.tryGenerateOne(size.rows, size.cols, {
          title: config.getTitle(puzzles.length),
          category: config.category,
        }, config.strictSize ? 24 : undefined);
        if (generated) {
          if (size.rows !== requested.rows || size.cols !== requested.cols) {
            console.log(`   ↘️  ${requested.rows}x${requested.cols} too tight, using ${size.rows}x${size.cols}`);
          }
          break;
        }
        if (chain.length > 1) {
          console.log(`   … ${size.rows}x${size.cols} did not fill, trying a smaller grid`);
        }
      }

      if (generated) {
        puzzles.push(generated);
        console.log(
          `✅ Puzzle ${puzzles.length}/${config.count}: ${generated.puzzleItems.length} clues ` +
          `(${generated.grid.rows}x${generated.grid.cols})`
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
    meta: { title: string; category: string },
    attemptOverride?: number
  ): Puzzle | null {
    const cells = rows * cols;
    const attempts = attemptOverride ?? (this.language === 'he'
      ? (cells >= 144 ? 24 : cells >= 121 ? 20 : cells >= 100 ? 18 : 16)
      : 15);

    for (let attempt = 0; attempt < attempts; attempt++) {
      const template = this.buildTemplate(rows, cols);
      if (!template) continue;
      if (template.slots.some(slot => slot.length > 13 || slot.length < 3)) {
        continue;
      }
      const puzzle = this.solveTemplate(template, meta);
      if (!puzzle) continue;
      return puzzle;
    }
    return null;
  }

 

  private buildTemplate(rows: number, cols: number): GridTemplate | null {
    const cells = rows * cols;
    const large = cells >= 100;
    try {
      return generateTemplate({
        rows,
        cols,
        name: `${rows}x${cols} arrow crossword`,
        quiet: true,
        maxIterations: this.language === 'he' ? (large ? 28 : 20) : 8,
        minPopulation: 3,
        populationSize: this.language === 'he' ? (large ? 10 : 8) : 5,
        weakBreakCondition: this.language === 'he' ? (large ? 220 : 150) : 80,
        strongBreakCondition: this.language === 'he' ? (large ? 550 : 400) : 250,
        sparse: this.language === 'he' && cells >= 81,
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
    const maxSolveTimeMs = ((this.language === 'he' ? 16 : 12) * 1000) + cells * 50;

    // Prefer more common words so grids feel familiar; jitter keeps puzzles varied.
    // Hebrew also steers toward a target share of tagged difficulty-1 (everyday) answers.
    const jitter = new Map<string, number>();
    const wordScorer = (word: string, placedWords: string[]) => {
      let j = jitter.get(word);
      if (j === undefined) {
        j = Math.random();
        jitter.set(word, j);
      }
      const rank = this.clueProvider.getAnswerRank(word);
      const rankScore = -Math.log(Math.max(rank, 1)) + j;
      return rankScore;
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
        return null; // retry with a new template
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
}): Puzzle[] {
  const language = config.language ?? 'en';
  const generator = new PuzzleGenerator(language);
  return generator.generateBatch({
    count: config.count,
    category: config.category,
    getTitle: (i) => language === 'he'
      ? `${config.startIndex + i}`
      : `${config.startIndex + i}`,
    rows: config.rows,
    cols: config.cols,
    sizes: config.sizes,
    strictSize: config.strictSize,
  });
}
