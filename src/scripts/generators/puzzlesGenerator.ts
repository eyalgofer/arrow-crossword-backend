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
   */
  generateBatch(config: {
    count: number;
    category: string;
    getTitle: (index: number) => string;
    rows?: number;
    cols?: number;
  }): Puzzle[] {
    const rows = config.rows ?? 10;
    const cols = config.cols ?? 10;
    const puzzles: Puzzle[] = [];
    const maxAttempts = config.count * 5; // each attempt = new template + solve

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
    // Scale evolutionary iterations with grid size (10x10 -> 25, larger grids more)
    const cells = rows * cols;
    const maxIterations = Math.min(150, Math.max(25, Math.ceil(25 * (cells / 100))));
    try {
      return generateTemplate({
        rows,
        cols,
        difficulty: this.difficulty,
        name: `${rows}x${cols} arrow crossword`,
        quiet: true,
        maxIterations,
        minPopulation: 5,
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
    const maxAttempts = Math.min(100000 + slotCount * 8000, 500000);

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
      maxSolveTimeMs: 90 * 1000,
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
