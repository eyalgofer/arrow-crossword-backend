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
    
    this.addGeneratedTemplates();
  }

  addGeneratedTemplate(difficulty: Difficulty = Difficulty.MEDIUM): void {
    const size: 'medium' | 'large' | 'xlarge' = 
      this.difficulty === Difficulty.EASY ? 'medium' :
      this.difficulty === Difficulty.MEDIUM ? 'medium' :
      this.difficulty === Difficulty.CHALLENGING ? 'medium' :
      this.difficulty === Difficulty.HARD ? 'medium' :
      this.difficulty === Difficulty.EXPERT ? 'medium' :
      'medium';
    const template = generateTemplate(size, difficulty);
    this.templates.push(template);
    console.log(`Generated template: ${template.name} (${template.rows}x${template.cols}, ${template.slots.length} slots)`);
  }
  
  addGeneratedTemplates(): void {
    this.addGeneratedTemplate(this.difficulty);
  }
  
  generateFromTemplate(
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
    
    // If that fails, try multiple strategies with maximum attempts
    if (!result) {
      console.log(`  🔄 Retrying without word reuse...`);
      result = solveGrid(template, this.wordIndex, {
        maxAttempts: maxAttempts * 2, // Double attempts for retry
        shuffleWords: true,
        preferCommonWords: true,
        allowWordReuse: false
      });
    }
    
    // If still failing, try with different strategies
    if (!result) {
      console.log(`  🔄 Retrying with different word ordering...`);
      result = solveGrid(template, this.wordIndex, {
        maxAttempts: maxAttempts * 2,
        shuffleWords: false, // Try without shuffling
        preferCommonWords: false, // Try without preference
        allowWordReuse: true
      });
    }
    
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
        category: config.category,
        estimatedTime: config.difficulty === Difficulty.EASY ? 8 : 
                       config.difficulty === Difficulty.MEDIUM ? 12 :
                       config.difficulty === Difficulty.CHALLENGING ? 16 :
                       config.difficulty === Difficulty.HARD ? 18 :
                       config.difficulty === Difficulty.EXPERT ? 25 :
                       15,
        coinReward: config.difficulty === Difficulty.EASY ? 5 :
                      config.difficulty === Difficulty.MEDIUM ? 10 :
                      config.difficulty === Difficulty.CHALLENGING ? 20 :
                      config.difficulty === Difficulty.HARD ? 25 :
                      config.difficulty === Difficulty.EXPERT ? 30 :
                      10
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
    const maxTemplateAttempts = 50; // More attempts to find perfect dense template
    const maxTotalTime = 30 * 60 * 1000; // 30 minutes max - take time to find perfect puzzle
    const startTime = Date.now();
    
    while (attempts < maxTemplateAttempts) {
      attempts++;
      
      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > maxTotalTime) {
        console.log(`\n⏱️  Timeout: Exceeded ${maxTotalTime / 1000}s total time limit`);
        break;
      }
      
      // TODO: change template size once we fix the generation of hard/expert puzzles
      const templateSize: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge' = 
        this.difficulty === Difficulty.EASY ? 'medium' :      // 11x11
        this.difficulty === Difficulty.MEDIUM ? 'medium' :    // 11x11
        this.difficulty === Difficulty.CHALLENGING ? 'medium' : // 11x11
        this.difficulty === Difficulty.HARD ? 'medium' : // 11x11
        this.difficulty === Difficulty.EXPERT ? 'medium' : // 11x11
        'medium'; // 11x11
      console.log(`\n🔄 Attempt ${attempts}/${maxTemplateAttempts} - Generating fresh ${templateSize} template... (${(elapsed / 1000).toFixed(1)}s elapsed)`);
      const templateStartTime = Date.now();
      
      this.templates = [];
      this.addGeneratedTemplate(this.difficulty);
      
      if (this.templates.length === 0) {
        console.log(`   ⚠️  Failed to generate template, skipping...`);
        continue;
      }
      
      const template = this.templates[0];
      const templateTime = Date.now() - templateStartTime;
      const density = ((template.slots.length * 4) / (template.rows * template.cols) * 100).toFixed(1);
      console.log(`   📋 Template: ${template.slots.length} slots, ${template.rows}x${template.cols} grid, ~${density}% density (${templateTime}ms)`);
      
      // Only proceed if template has reasonable density
      const minSlots = this.difficulty === Difficulty.EASY ? 20 :      
                       this.difficulty === Difficulty.MEDIUM ? 20 :    
                       this.difficulty === Difficulty.CHALLENGING ? 20 : 
                       this.difficulty === Difficulty.HARD ? 20 :
                       this.difficulty === Difficulty.EXPERT ? 20 :
                       20;  
      if (template.slots.length < minSlots) {
        console.log(`   ⚠️  Template too sparse (${template.slots.length} slots, need ${minSlots}), trying again...`);
        continue;
      }
      
      console.log(`   🧩 Attempting to solve template with ~6M clues based on difficulty...`);
      const solveStartTime = Date.now();
      const puzzle = this.generateFromTemplate(0, {
        title: `${config.title}`,
        difficulty: this.difficulty,
        category: config.category
      });
      const solveTime = Date.now() - solveStartTime;
      console.log(`   ⏱️  Solve attempt took ${solveTime}ms`);
      
      if (puzzle) {
        console.log(`\n✅ SUCCESS! Generated puzzle: "${puzzle.title}"`);
        console.log(`   Grid: ${puzzle.grid.rows}x${puzzle.grid.cols}`);
        console.log(`   Puzzle Items: ${puzzle.puzzleItems.length}`);
        console.log(`   Difficulty: ${puzzle.difficulty}`);
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
    console.log(`  Estimated Time: ${puzzle.estimatedTime} minutes`);
    console.log(`  Coin Reward: ${puzzle.coinReward}`);
  } else {
    console.log('\n❌ Failed to generate perfect puzzle');
  }
  
  return puzzle;
}

export {
  getClue 
};