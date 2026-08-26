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

/** Share of answers that should come from tagged difficulty-1 (everyday) Hebrew vocab. */
const EASY_VOCAB_TARGET: Record<Difficulty, number> = {
  [Difficulty.EASY]: 0.5,
  [Difficulty.MEDIUM]: 0.3,
  [Difficulty.CHALLENGING]: 0.1,
  [Difficulty.HARD]: 0.1,
  [Difficulty.EXPERT]: 0.1,
};

/** Accept a fill if |ratio - target| is within this window. */
const EASY_VOCAB_TOLERANCE: Record<Difficulty, number> = {
  [Difficulty.EASY]: 0.15,
  [Difficulty.MEDIUM]: 0.12,
  [Difficulty.CHALLENGING]: 0.1,
  [Difficulty.HARD]: 0.1,
  [Difficulty.EXPERT]: 0.1,
};

/** Minimum words of a given length before that slot size is considered fillable. */
const MIN_WORDS_PER_LENGTH = 12;

export class PuzzleGenerator {
  private wordIndex: CrossingIndex;
  private difficulty: Difficulty;
  private language: Language;
  private clueProvider: ClueProvider;
  private maxSlotLength: number;

  constructor(difficulty: Difficulty = Difficulty.MEDIUM, language: Language = 'en') {
    this.difficulty = difficulty;
    this.language = language;
    this.clueProvider = getClueProvider(language);

    const words = this.clueProvider.getWordPool(difficulty);
    if (words.length === 0) {
      throw new Error(
        `Word pool for difficulty '${difficulty}' (${language}) is empty. Check that ` +
        `the clue database sources exist in src/scripts/core.`
      );
    }
    this.maxSlotLength = maxFillableSlotLength(words);
    // Hebrew has fewer long answers than English; keep slots inside 2-11.
    if (this.language === 'he') {
      this.maxSlotLength = Math.min(this.maxSlotLength, 11);
    }
    console.log(
      `🎯 Word pool for '${difficulty}' (${language}): ${words.length.toLocaleString()} words ` +
      `(max slot ${this.maxSlotLength})`
    );
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
    const defaultRows = Math.min(config.rows ?? 8, MAX_GRID_SIZE);
    const defaultCols = Math.min(config.cols ?? 8, MAX_GRID_SIZE);
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
        const mix = this.easyVocabMixLabel(generated);
        console.log(
          `✅ Puzzle ${puzzles.length}/${config.count}: ${generated.puzzleItems.length} clues ` +
          `(${generated.grid.rows}x${generated.grid.cols}${mix})`
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

    const useMix = this.language === 'he' && !!this.clueProvider.isEasyVocab;
    const target = EASY_VOCAB_TARGET[this.difficulty];
    const tolerance = EASY_VOCAB_TOLERANCE[this.difficulty];
    let best: Puzzle | null = null;
    let bestError = Infinity;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const template = this.buildTemplate(rows, cols);
      if (!template) continue;
      if (template.slots.some(slot => slot.length > this.maxSlotLength || slot.length < 3)) {
        continue;
      }
      const puzzle = this.solveTemplate(template, meta);
      if (!puzzle) continue;
      if (!useMix) return puzzle;

      const error = Math.abs(this.easyVocabRatio(puzzle) - target);
      if (error < bestError) {
        best = puzzle;
        bestError = error;
      }
      if (error <= tolerance) return puzzle;
    }
    return best;
  }

  private easyVocabRatio(puzzle: Puzzle): number {
    const items = puzzle.puzzleItems;
    if (items.length === 0 || !this.clueProvider.isEasyVocab) return 0;
    const easy = items.filter(item => this.clueProvider.isEasyVocab!(item.answer)).length;
    return easy / items.length;
  }

  private easyVocabMixLabel(puzzle: Puzzle): string {
    if (this.language !== 'he' || !this.clueProvider.isEasyVocab) return '';
    const items = puzzle.puzzleItems;
    const easy = items.filter(item => this.clueProvider.isEasyVocab!(item.answer)).length;
    const pct = items.length === 0 ? 0 : Math.round((100 * easy) / items.length);
    return `, ${easy}/${items.length} easy-vocab ${pct}%`;
  }

  private buildTemplate(rows: number, cols: number): GridTemplate | null {
    const cells = rows * cols;
    const large = cells >= 100;
    try {
      return generateTemplate({
        rows,
        cols,
        difficulty: this.difficulty,
        name: `${rows}x${cols} arrow crossword`,
        quiet: true,
        maxIterations: this.language === 'he' ? (large ? 28 : 20) : 8,
        minPopulation: 3,
        populationSize: this.language === 'he' ? (large ? 10 : 8) : 5,
        weakBreakCondition: this.language === 'he' ? (large ? 220 : 150) : 80,
        strongBreakCondition: this.language === 'he' ? (large ? 550 : 400) : 250,
        maxSlotLength: this.maxSlotLength,
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
    const target = EASY_VOCAB_TARGET[this.difficulty];
    const isEasy = (w: string) => this.clueProvider.isEasyVocab?.(w) === true;
    const wordScorer = (word: string, placedWords: string[]) => {
      let j = jitter.get(word);
      if (j === undefined) {
        j = Math.random();
        jitter.set(word, j);
      }
      const rank = this.clueProvider.getAnswerRank(word);
      const rankScore = -Math.log(Math.max(rank, 1)) + j;
      if (this.language !== 'he' || !this.clueProvider.isEasyVocab) return rankScore;

      const n = placedWords.length;
      const placedEasy = placedWords.filter(isEasy).length;
      const currentErr = n === 0 ? 0 : Math.abs(placedEasy / n - target);
      const nextEasy = placedEasy + (isEasy(word) ? 1 : 0);
      const nextErr = Math.abs(nextEasy / (n + 1) - target);
      return rankScore + (currentErr - nextErr) * 12;
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
        difficulty: this.difficulty,
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

function maxFillableSlotLength(words: string[]): number {
  const counts = new Map<number, number>();
  for (const word of words) {
    const length = Array.from(normalizeWord(word)).length;
    counts.set(length, (counts.get(length) ?? 0) + 1);
  }
  let max = 2;
  for (const [len, count] of counts) {
    if (count >= MIN_WORDS_PER_LENGTH && len > max) max = len;
  }
  return max;
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
  const generator = new PuzzleGenerator(config.difficulty, language);
  return generator.generateBatch({
    count: config.count,
    category: config.category,
    getTitle: (i) => language === 'he'
      ? `תשבץ ${config.startIndex + i}`
      : `Puzzle ${config.startIndex + i}`,
    rows: config.rows,
    cols: config.cols,
    sizes: config.sizes,
    strictSize: config.strictSize,
  });
}
