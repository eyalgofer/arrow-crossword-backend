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

const MAX_GRID_SIZE = 10;

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
    // Hebrew still has far fewer long answers than English; 8+ letter slots
    // starve the solver. Cap so every letter cell can actually be filled.
    if (this.language === 'he') {
      this.maxSlotLength = Math.min(this.maxSlotLength, 7);
    }
    console.log(
      `🎯 Word pool for '${difficulty}' (${language}): ${words.length.toLocaleString()} words ` +
      `(max slot ${this.maxSlotLength})`
    );
    this.wordIndex = buildCrossingIndex(words);
  }

  /**
   * Generate `count` puzzles. Each puzzle gets a fresh template so grids vary.
   * Grid size is capped at 10x10 for reliable fill quality.
   */
  generateBatch(config: {
    count: number;
    category: string;
    getTitle: (index: number) => string;
    rows?: number;
    cols?: number;
  }): Puzzle[] {
    const rows = Math.min(config.rows ?? 8, MAX_GRID_SIZE);
    const cols = Math.min(config.cols ?? 8, MAX_GRID_SIZE);
    if ((config.rows ?? 0) > MAX_GRID_SIZE || (config.cols ?? 0) > MAX_GRID_SIZE) {
      console.warn(`⚠️  Grid capped at ${MAX_GRID_SIZE}x${MAX_GRID_SIZE} (requested ${config.rows}x${config.cols})`);
    }
    const puzzles: Puzzle[] = [];
    const attemptMultiplier = this.language === 'he' ? 40 : 15;
    const maxAttempts = config.count * attemptMultiplier; // each attempt = new template + solve

    for (let attempt = 0; attempt < maxAttempts && puzzles.length < config.count; attempt++) {
      const template = this.buildTemplate(rows, cols);
      if (!template) continue;
      if (template.slots.some(slot => slot.length > this.maxSlotLength || slot.length < 3)) {
        continue;
      }

      const puzzle = this.solveTemplate(template, {
        title: config.getTitle(puzzles.length),
        category: config.category,
      });
      if (puzzle) {
        puzzles.push(puzzle);
        console.log(`✅ Puzzle ${puzzles.length}/${config.count}: ${puzzle.puzzleItems.length} clues (${rows}x${cols})`);
      }
    }

    if (puzzles.length < config.count) {
      console.warn(`⚠️  Generated ${puzzles.length}/${config.count} puzzles after ${maxAttempts} attempts`);
    }
    return puzzles;
  }

  private buildTemplate(rows: number, cols: number): GridTemplate | null {
    // Fast template search: word/clue quality matters more than mask perfection.
    try {
      return generateTemplate({
        rows,
        cols,
        difficulty: this.difficulty,
        name: `${rows}x${cols} arrow crossword`,
        quiet: true,
        maxIterations: this.language === 'he' ? 20 : 8,
        minPopulation: 3,
        populationSize: this.language === 'he' ? 8 : 5,
        weakBreakCondition: this.language === 'he' ? 150 : 80,
        strongBreakCondition: this.language === 'he' ? 400 : 250,
        maxSlotLength: this.maxSlotLength,
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
    // Short budget per template: solvable templates fill in a few seconds,
    // and a fresh template is cheaper than grinding an unlucky one.
    const maxSolveTimeMs = (this.language === 'he' ? 20 : 15) * 1000;

    // Prefer more common words so grids feel familiar; jitter keeps puzzles varied.
    const jitter = new Map<string, number>();
    const wordScorer = (word: string) => {
      let j = jitter.get(word);
      if (j === undefined) {
        j = Math.random();
        jitter.set(word, j);
      }
      const rank = this.clueProvider.getAnswerRank(word);
      return -Math.log(rank) + j;
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
    counts.set(word.length, (counts.get(word.length) ?? 0) + 1);
  }
  let max = 3;
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
  language?: Language;
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
  });
}
