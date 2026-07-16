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

import { Difficulty } from '../../types';
import { Puzzle, GridTemplate } from '../core/types';
import { getWordPool, getAnswerRank } from '../core/clueDatabase';
import { generateTemplate } from './template-generator';
import { solveGrid } from './grid-solver';
import { buildCrossingIndex, CrossingIndex } from './word-index';
import { generatePuzzleFromGrid } from './puzzle-assembler';

const MAX_GRID_SIZE = 10;

export class PuzzleGenerator {
  private wordIndex: CrossingIndex;
  private difficulty: Difficulty;

  constructor(difficulty: Difficulty = Difficulty.MEDIUM) {
    this.difficulty = difficulty;

    const words = getWordPool(difficulty);
    if (words.length === 0) {
      throw new Error(
        `Word pool for difficulty '${difficulty}' is empty. Check that ` +
        `synonyms.csv / train.csv / wordlist-en-50k.txt exist in src/scripts/core.`
      );
    }
    console.log(`🎯 Word pool for '${difficulty}': ${words.length.toLocaleString()} words`);
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
    const maxAttempts = config.count * 15; // each attempt = new template + solve

    for (let attempt = 0; attempt < maxAttempts && puzzles.length < config.count; attempt++) {
      const template = this.buildTemplate(rows, cols);
      if (!template) continue;

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
        maxIterations: 8,
        minPopulation: 3,
        populationSize: 5,
        weakBreakCondition: 80,
        strongBreakCondition: 250,
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
    const maxSolveTimeMs = 15 * 1000;

    // Prefer more common words so grids feel familiar; jitter keeps puzzles varied.
    const jitter = new Map<string, number>();
    const wordScorer = (word: string) => {
      let j = jitter.get(word);
      if (j === undefined) {
        j = Math.random();
        jitter.set(word, j);
      }
      const rank = getAnswerRank(word);
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
}): Puzzle[] {
  const generator = new PuzzleGenerator(config.difficulty);
  return generator.generateBatch({
    count: config.count,
    category: config.category,
    getTitle: (i) => `Puzzle ${config.startIndex + i}`,
    rows: config.rows,
    cols: config.cols,
  });
}
