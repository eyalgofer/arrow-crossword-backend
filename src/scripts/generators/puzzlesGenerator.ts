import { Difficulty } from '../../types';
import {
  Puzzle,
  GridTemplate,
} from '../core/types';

import { generatePuzzleFromGrid, ClueDatabase } from './puzzle-assembler';
import { solveGrid } from './grid-solver';
import { buildCrossingIndex, CrossingIndex } from './word-index';
import { generateTemplate } from './template-generator';

import { getCluesDatabase, getClueForWord, getWordsWithMaxDifficulty } from '../core/cluesFromCSV';
import { normalizeWord } from './validation-utils';

export type ClueDifficulty = 'easy' | 'medium' | 'challenging' | 'hard' | 'expert';

// Load clues database (with difficulty classification)
const CLUES_DB = getCluesDatabase();

/**
 * Map puzzle Difficulty to clue ClueDifficulty
 * Note: We cap at 'challenging' for puzzle packages (no hard/expert clues)
 */
function mapDifficulty(difficulty: Difficulty): ClueDifficulty {
  switch (difficulty) {
    case Difficulty.EASY:
      return 'easy';
    case Difficulty.MEDIUM:
      return 'medium';
    case Difficulty.CHALLENGING:
      return 'challenging';
    case Difficulty.HARD:
      return 'hard';
    case Difficulty.EXPERT:
      return 'expert';
    default:
      return 'medium';
  }
}

/**
 * Get a clue for a word, filtered by difficulty
 * Uses max difficulty of 'challenging' (no hard/expert clues)
 */
function getClue(word: string, difficulty: Difficulty = Difficulty.EASY): string {
  const clueDifficulty = mapDifficulty(difficulty);
  const clue = getClueForWord(word, clueDifficulty);
  if (clue) {
    return clue;
  }
  // Fallback
  return `[${word}]`;
}

/**
 * Get all available clues for a word, filtered by difficulty
 * Uses max difficulty of 'challenging' (no hard/expert clues)
 */
function getAllClues(word: string, difficulty: Difficulty = Difficulty.EASY): string[] {
  const clueDifficulty = mapDifficulty(difficulty);
  const normalizedWord = normalizeWord(word);
  const entries = CLUES_DB.byAnswer[normalizedWord];
  
  if (!entries || entries.length === 0) {
    return [`[${word}]`];
  }
  
  // Build allowed difficulties up to max (challenging)
  const difficultyOrder: ClueDifficulty[] = ['easy', 'medium', 'challenging'];
  const preferredIndex = difficultyOrder.indexOf(clueDifficulty);
  const allowedDifficulties = new Set(difficultyOrder.slice(0, Math.max(preferredIndex + 1, 1)));
  
  const filteredClues = entries
    .filter(e => allowedDifficulties.has(e.difficulty))
    .map(e => e.clue);
  
  if (filteredClues.length > 0) {
    return filteredClues;
  }
  
  const allAllowed = new Set<ClueDifficulty>(['easy', 'medium', 'challenging', 'hard', 'expert']);
  const fallbackClues = entries
    .filter(e => allAllowed.has(e.difficulty))
    .map(e => e.clue);
  
  if (fallbackClues.length > 0) {
    return fallbackClues;
  }
  
  // Last resort fallback
  return [`[${word}]`];
}
export class PuzzleGenerator {
  private wordIndex: CrossingIndex;
  private templates: GridTemplate[] = [];
  private difficulty: Difficulty;
  
  constructor(difficulty: Difficulty = Difficulty.MEDIUM) {
    this.difficulty = difficulty;
    
    // Build word index for fast lookups, filtered by difficulty
    // Convert Difficulty enum to ClueDifficulty string type
    const clueDifficulty = mapDifficulty(difficulty);
    let words = getWordsWithMaxDifficulty(clueDifficulty);
    
    if (words.length === 0) {
      throw new Error(`No words available for difficulty '${clueDifficulty}'. This indicates a problem with the clues database or difficulty filtering.`);
    }
    
    // For hard/expert puzzles, limit word pool to avoid stack overflow
    // We don't need all 300k+ words - a subset is sufficient for generation
    const MAX_WORDS_FOR_INDEX = 100000; // Limit to 100k words to prevent stack overflow
    if (words.length > MAX_WORDS_FOR_INDEX) {
      // Sample evenly across the array to get variety without shuffling
      const step = Math.floor(words.length / MAX_WORDS_FOR_INDEX);
      words = words.filter((_, index) => index % step === 0).slice(0, MAX_WORDS_FOR_INDEX);
    }
    
    this.wordIndex = buildCrossingIndex(words.map(key => key.toUpperCase()));
    
    // Verify word index was built correctly (use iterative approach to avoid stack overflow)
    let totalWordsInIndex = 0;
    for (const arr of this.wordIndex.byLength.values()) {
      totalWordsInIndex += arr.length;
    }
    if (totalWordsInIndex === 0) {
      throw new Error(`Word index is empty after building. Expected ${words.length} words but got 0.`);
    }
  }

  buildGeneratedTemplate(difficulty: Difficulty = Difficulty.MEDIUM): boolean {
    try {
      const template = generateTemplate(difficulty);
      this.templates.push(template);
      return true;
    } catch (error) {
      // Template generation failed (e.g., couldn't place enough slots)
      // Log the error but don't throw - let the retry loop try again
      if (error instanceof Error) {
        console.log(`   ⚠️  Template generation failed: ${error.message}`);
      } else {
        console.log(`   ⚠️  Template generation failed: ${error}`);
      }
      return false;
    }
  }

  
  solveTemplate(
    templateIndex: number = 0,
    config: {
      title: string;
      difficulty: Difficulty;
      category: string;
    }
  ): Puzzle | null {
    if (templateIndex >= this.templates.length) {
      throw new Error(`Template index ${templateIndex} out of bounds`);
    }
    
    const template = this.templates[templateIndex];

    const slotCount = template.slots.length;
    const baseAttempts = 500000; 
    const attemptsPerSlot = 50000;
    const maxAttempts = Math.min(baseAttempts + (slotCount * attemptsPerSlot), 10000000);
    
    let result = solveGrid(template, this.wordIndex, {
      maxAttempts: maxAttempts,
      shuffleWords: true,
      preferCommonWords: true,
      allowWordReuse: true
    });
    
    if (!result) {
      console.log(`Failed to generate puzzle variant (template: ${template.name}, slots: ${template.slots.length})`);
      return null;
    }
    
    // Create clue database
    const clueDb: ClueDatabase = {
      getClue: (word: string, difficulty: Difficulty) => getClue(word, difficulty),
      getAllClues: (word: string, difficulty: Difficulty) => getAllClues(word, difficulty)
    };
    
    // Build the puzzle
    try {

      const puzzle = generatePuzzleFromGrid(
        template,
        result,
        clueDb,
        {
        title: config.title,
        difficulty: config.difficulty,
        category: config.category
        }
      );

      return puzzle;
    } catch (error) {
      // Validation errors should be caught and logged
      if (error instanceof Error && error.message.includes('validation failed')) {
        console.error(`  ❌ Puzzle validation error: ${error.message}`);
        return null; // Return null to trigger retry
      }
      // Re-throw other errors
      throw error;
    }
  }

  generate(
    config: {      
      category: string;
      title: string;
    }
  ): Puzzle | null {
    console.log('🎯 Generating puzzle...');
    let attempts = 0;
    const maxTemplateAttempts = 100;
    const maxTotalTime = 2 * 60 * 1000; // 2 minutes
    const startTime = Date.now();
    
    while (attempts < maxTemplateAttempts) {
      attempts++;
      
      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > maxTotalTime) {
        console.log(`\n⏱️  Timeout: Exceeded ${maxTotalTime / 1000}s total time limit`);
        break;
      }

      this.templates = [];
      const templateGenerated = this.buildGeneratedTemplate(this.difficulty);
      
      if (!templateGenerated || this.templates.length === 0) {
        console.log(`   ⚠️  Failed to generate template, trying again...`);
        continue;
      }

      const solveStartTime = Date.now();
      const puzzle = this.solveTemplate(0, {
        title: `${config.title}`,
        difficulty: this.difficulty,
        category: config.category
      });
      const solveTime = Date.now() - solveStartTime;
      console.log(`   ⏱️  Solve attempt took ${solveTime / 1000} seconds`);
      
      if (puzzle) {
        return puzzle;
      }
      
      if (attempts % 3 === 0) {
        console.log(`   Still trying... (${attempts}/${maxTemplateAttempts} attempts)`);
      }
    }
    
    console.log(`\n❌ Failed to generate puzzle after ${attempts} attempts`);
    return null;
  }
}

export function generatePuzzle(
  config: {
    difficulty?: Difficulty;
    category?: string;
    title?: string;
  } = {}
): Puzzle | null {
  const difficulty = config.difficulty || Difficulty.MEDIUM;
  const clueDifficulty = mapDifficulty(difficulty);
  
  console.log('='.repeat(60));
  console.log('🎯 PUZZLE GENERATOR - Difficulty-Aware');
  console.log(`   Difficulty: ${difficulty} (using ${clueDifficulty} clues)`);
  console.log('='.repeat(60));
  
  const generator = new PuzzleGenerator(difficulty);
  
  const puzzle = generator.generate({    
    category: config.category || 'Misc',
    title: config.title || 'Generated Puzzle'
  });
  
  if (puzzle) {
    console.log('\n' + '='.repeat(60));
    console.log('✅ PUZZLE GENERATED:');
    console.log('='.repeat(60));
    console.log(`  Title: ${puzzle.title}`);
    console.log(`  Grid: ${puzzle.grid.rows}x${puzzle.grid.cols}`);
    console.log(`  Puzzle Items: ${puzzle.puzzleItems.length}`);
    console.log(`  Difficulty: ${puzzle.difficulty}`);
    console.log(`  Category: ${puzzle.category}`);
    console.log(`  Estimated Time: ${puzzle.estimatedTime} seconds`);
    console.log(`  Coin Reward: ${puzzle.coinReward}`);
  } else {
    console.log('\n❌ Failed to generate perfect puzzle');
  }

  return puzzle;
}

export {
  getClue 
};