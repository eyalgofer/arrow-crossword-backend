import { Difficulty } from '../../types';
import {
  Puzzle,
  GridTemplate,
} from '../core/types';

import { generatePuzzleFromGrid, ClueDatabase, ClueSourceTracker } from './puzzle-assembler';
import { solveGrid } from './grid-solver';
import { buildCrossingIndex, CrossingIndex } from './word-index';
import { generateTemplate } from './template-generator';

import { getCluesDatabase, getClueForWord, getWordsWithMaxDifficulty, getSimpleDatabase, getTrainDatabase } from '../core/cluesFromCSV';
import { normalizeWord } from './validation-utils';

export type ClueDifficulty = 'easy' | 'medium' | 'challenging' | 'hard' | 'expert';

// Load clues databases (with difficulty classification)
const CLUES_DB = getCluesDatabase();
const SIMPLE_DB = getSimpleDatabase();
const TRAIN_DB = getTrainDatabase();

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
 * Tracks which database was used if tracker is provided
 */
function getClue(word: string, difficulty: Difficulty = Difficulty.EASY, tracker?: { simpleCount: number; trainCount: number }): string {
  const clueDifficulty = mapDifficulty(difficulty);
  const normalizedWord = normalizeWord(word);
  
  // Try simple.csv first
  const simpleEntries = SIMPLE_DB.byAnswer[normalizedWord];
  if (simpleEntries && simpleEntries.length > 0) {
    const clue = getClueForWord(word, clueDifficulty);
    if (clue && tracker) {
      // Verify clue came from simple.csv by checking if it exists there
      const simpleClues = simpleEntries.map(e => e.clue);
      if (simpleClues.includes(clue)) {
        tracker.simpleCount++;
        return clue;
      }
    } else if (clue) {
      return clue;
    }
  }
  
  // Fallback to train.csv
  const trainEntries = TRAIN_DB.byAnswer[normalizedWord];
  if (trainEntries && trainEntries.length > 0) {
    const clue = getClueForWord(word, clueDifficulty);
    if (clue && tracker) {
      tracker.trainCount++;
      return clue;
    } else if (clue) {
      return clue;
    }
  }
  
  // Fallback
  return `[${word}]`;
}

/**
 * Get all available clues for a word, filtered by difficulty
 * Tries simple.csv first (preferred), then falls back to train.csv
 * Uses max difficulty of 'challenging' (no hard/expert clues)
 * Tracks which database was used if tracker is provided
 */
function getAllClues(word: string, difficulty: Difficulty = Difficulty.EASY, tracker?: { simpleCount: number; trainCount: number }): string[] {
  const clueDifficulty = mapDifficulty(difficulty);
  const normalizedWord = normalizeWord(word);
  
  // Build allowed difficulties up to max (challenging)
  const difficultyOrder: ClueDifficulty[] = ['easy', 'medium', 'challenging'];
  const preferredIndex = difficultyOrder.indexOf(clueDifficulty);
  const allowedDifficulties = new Set(difficultyOrder.slice(0, Math.max(preferredIndex + 1, 1)));
  
  // Helper function to get clues from a database
  const getCluesFromDb = (db: typeof SIMPLE_DB): string[] => {
    const entries = db.byAnswer[normalizedWord];
    if (!entries || entries.length === 0) {
      return [];
    }
    
    const filteredClues = entries
      .filter(e => allowedDifficulties.has(e.difficulty))
      .map(e => e.clue);
    
    if (filteredClues.length > 0) {
      return filteredClues;
    }
    
    // Fallback to all allowed difficulties if no clues match preferred difficulty
    const allAllowed = new Set<ClueDifficulty>(['easy', 'medium', 'challenging', 'hard', 'expert']);
    const fallbackClues = entries
      .filter(e => allAllowed.has(e.difficulty))
      .map(e => e.clue);
    
    return fallbackClues;
  };
  
  // Try simple.csv first (preferred)
  const simpleClues = getCluesFromDb(SIMPLE_DB);
  if (simpleClues.length > 0) {
    // Track that we used simple.csv (will be counted when clue is actually selected)
    return simpleClues;
  }
  
  // Fallback to train.csv
  const trainClues = getCluesFromDb(TRAIN_DB);
  if (trainClues.length > 0) {
    // Track that we used train.csv (will be counted when clue is actually selected)
    return trainClues;
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
      const templateStartTime = Date.now();
      const template = generateTemplate(difficulty);
      const templateTime = Date.now() - templateStartTime;
      
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
    // Reduced max attempts for better performance
    // More conservative scaling: base + per-slot attempts, capped at 2M
    const baseAttempts = 100000;  // Reduced from 500k
    const attemptsPerSlot = 10000; // Reduced from 50k
    const maxAttempts = Math.min(baseAttempts + (slotCount * attemptsPerSlot), 2000000); // Cap at 2M instead of 10M
    
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
    
    // Create clue source tracker
    const clueSourceTracker = { simpleCount: 0, trainCount: 0 };
    
    // Create clue database with tracker
    const clueDb: ClueDatabase = {
      getClue: (word: string, difficulty: Difficulty) => getClue(word, difficulty, clueSourceTracker),
      getAllClues: (word: string, difficulty: Difficulty) => getAllClues(word, difficulty, clueSourceTracker),
      tracker: clueSourceTracker
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
    
    // Performance metrics
    const metrics = {
      templateGeneration: 0,
      slotPlacement: 0,
      crossingCalculation: 0,
      filtering: 0,
      solving: 0,
      puzzleAssembly: 0,
      totalAttempts: 0
    };
    
    let attempts = 0;
    const maxTemplateAttempts = 100;
    const maxTotalTime = 2 * 60 * 1000; // 2 minutes
    const startTime = Date.now();
    
    while (attempts < maxTemplateAttempts) {
      attempts++;
      metrics.totalAttempts = attempts;
      
      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > maxTotalTime) {
        console.log(`\n⏱️  Timeout: Exceeded ${maxTotalTime / 1000}s total time limit`);
        break;
      }

      this.templates = [];
      const templateStartTime = Date.now();
      const templateGenerated = this.buildGeneratedTemplate(this.difficulty);
      metrics.templateGeneration += Date.now() - templateStartTime;
      
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
      metrics.solving += Date.now() - solveStartTime;
      
      const solveTime = Date.now() - solveStartTime;
      console.log(`   ⏱️  Solve attempt took ${solveTime / 1000} seconds`);
      
      if (puzzle) {
        // Log performance metrics
        const totalTime = Date.now() - startTime;
        console.log(`\n⏱️  Performance Metrics:`);
        console.log(`   Template generation: ${metrics.templateGeneration}ms`);
        console.log(`   Solving: ${metrics.solving}ms`);
        console.log(`   Total time: ${totalTime}ms`);
        console.log(`   Attempts: ${attempts}`);
        
        return puzzle;
      }
      
      if (attempts % 3 === 0) {
        console.log(`   Still trying... (${attempts}/${maxTemplateAttempts} attempts)`);
      }
    }
    
    console.log(`\n❌ Failed to generate puzzle after ${attempts} attempts`);
    const totalTime = Date.now() - startTime;
    console.log(`\n⏱️  Performance Metrics:`);
    console.log(`   Template generation: ${metrics.templateGeneration}ms`);
    console.log(`   Solving: ${metrics.solving}ms`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Attempts: ${attempts}`);
    
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