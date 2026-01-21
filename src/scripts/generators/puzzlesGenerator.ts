import { Difficulty } from '../../types';
import {
  Puzzle,
  GridTemplate,
} from '../core/types';

import { createTemplateFromPuzzle, generatePuzzleFromGrid, ClueDatabase } from './puzzle-assembler';
import { solveGrid } from './grid-solver';
import { buildCrossingIndex, CrossingIndex } from './word-index';
import { generateTemplate } from './template-generator';

import { getCluesDatabase, getClueForWord, getCluesFiltered, getWordsForDifficulty, getWordsWithMaxDifficulty } from '../core/cluesFromCSV';
import { ClueDifficulty } from '../core/wordFrequency';

// Maximum clue difficulty allowed for puzzle packages (no hard/expert)
const MAX_CLUE_DIFFICULTY: ClueDifficulty = 'challenging';

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
    case Difficulty.EXPERT:
    default:
      // Cap at challenging for puzzle generation
      return 'challenging';
  }
}

/**
 * Get a clue for a word, filtered by difficulty
 * Uses max difficulty of 'challenging' (no hard/expert clues)
 */
function getClue(word: string, difficulty: Difficulty = Difficulty.EASY): string {
  const clueDifficulty = mapDifficulty(difficulty);
  const clue = getClueForWord(word, clueDifficulty, MAX_CLUE_DIFFICULTY);
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
  const normalizedWord = word.toUpperCase().replace(/\s+/g, '');
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
  
  // Fallback: try all clues up to challenging (but not hard/expert)
  const allAllowed = new Set<ClueDifficulty>(['easy', 'medium', 'challenging']);
  const fallbackClues = entries
    .filter(e => allAllowed.has(e.difficulty))
    .map(e => e.clue);
  
  if (fallbackClues.length > 0) {
    return fallbackClues;
  }
  
  // Last resort fallback
  return [`[${word}]`];
}

// ============================================================================
// MAIN GENERATOR CLASS
// ============================================================================

export class PuzzleGenerator {
  private wordIndex: CrossingIndex;
  private templates: GridTemplate[] = [];
  private difficulty: Difficulty;
  
  constructor(difficulty: Difficulty = Difficulty.MEDIUM) {
    this.difficulty = difficulty;
    
    // Build word index for fast lookups, filtered by difficulty
    // Use words that have clues at or below 'challenging' (no hard/expert)
    const words = getWordsWithMaxDifficulty(MAX_CLUE_DIFFICULTY);
    
    console.log(`📚 Building word index with max difficulty '${MAX_CLUE_DIFFICULTY}': ${words.length.toLocaleString()} words available`);
    this.wordIndex = buildCrossingIndex(words.map(key => key.toUpperCase()));
  }
  
  /**
   * Add a template from an existing puzzle
   */
  addTemplateFromPuzzle(puzzle: Puzzle): void {
    const template = createTemplateFromPuzzle(puzzle);
    this.templates.push(template);
    console.log(`Added template: ${template.name} (${template.slots.length} slots)`);
  }
  
  /**
   * Add simple template for easier generation
   * Note: This method is kept for compatibility but templates should be added explicitly
   */
  addSimpleTemplate(): void {
    // Simple templates can be added here if needed
    // For now, we rely on programmatic generation
  }
  
  /**
   * Generate and add a programmatic template of specified size
   */
  addGeneratedTemplate(difficulty: Difficulty = Difficulty.EASY): void {
    const size: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge' = 
      this.difficulty === Difficulty.EASY ? 'medium' :
      this.difficulty === Difficulty.MEDIUM ? 'medium' :
      this.difficulty === Difficulty.CHALLENGING ? 'medium' :
      'large';      
    const template = generateTemplate(size, difficulty);
    
    // Validate template has minimum required slots
    // Scale minimums based on template size
    const minSlots = size === 'medium' ? 11 : size === 'large' ? 50 : 55;
    if (template.slots.length < minSlots) {
      console.warn(`⚠️  Skipping template: Only ${template.slots.length} slots (need ${minSlots} for ${size})`);
      return;
    }
    
    this.templates.push(template);
    console.log(`Generated template: ${template.name} (${template.rows}x${template.cols}, ${template.slots.length} slots)`);
  }
  
  /**
   * Add multiple generated templates of different sizes
   * Template size is based on difficulty and available word count
   * All grids are now 11x11 or larger (no tiny 7x7)
   */
  addGeneratedTemplates(): void {
    // All puzzles now use at least 11x11 grids (medium size)
    // With 124k+ words available at max 'challenging' difficulty, we can handle larger grids
    // 15x15
    this.addGeneratedTemplate(this.difficulty);
  }
  
  /**
   * Generate a puzzle variant from a template
   */
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
    
    // MAXIMUM COMPUTE POWER: With 6M clues, we can try many more combinations
    // Use massive attempts to find perfect dense solutions
    const slotCount = template.slots.length;
    const baseAttempts = 500000; // Much higher with huge clue database
    const attemptsPerSlot = 50000; // Much higher per slot
    const maxAttempts = Math.min(baseAttempts + (slotCount * attemptsPerSlot), 10000000); // Cap at 10M - use all compute power
    
    // Solve the grid with increased attempts and allow word reuse
    // Try with word reuse first (easier), then without if needed
    let result = solveGrid(template, this.wordIndex, {
      maxAttempts: maxAttempts,
      shuffleWords: true,
      preferCommonWords: true,
      allowWordReuse: true // Allow words to be reused if needed
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
    const puzzle = generatePuzzleFromGrid(
      template,
      result,
      clueDb,
      {
      title: config.title,
      difficulty: config.difficulty,
      category: config.category,
      estimatedTime: config.difficulty === Difficulty.EASY ? 5 : 
                     config.difficulty === Difficulty.MEDIUM ? 15 : 25,
      coinReward: config.difficulty === Difficulty.EASY ? 2 :
                    config.difficulty === Difficulty.MEDIUM ? 5 :10
      }
    );

    return puzzle;
  }
  
  /**
   * Generate ONE perfect puzzle with maximum compute power
   * Generates a NEW template for each attempt until we get a solvable puzzle
   */
  generatePuzzle(
    config: {
      difficulty: Difficulty;
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
      
      // Generate a FRESH template for each attempt
      // All grids are now 11x11 or larger (no tiny 7x7)
      const templateSize: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge' = 
        config.difficulty === Difficulty.EASY ? 'medium' :      // 11x11 (was 7x7)
        config.difficulty === Difficulty.MEDIUM ? 'medium' :    // 11x11
        config.difficulty === Difficulty.CHALLENGING ? 'small' : // 14x14
        'large';                                                 // 15x15
      console.log(`\n🔄 Attempt ${attempts}/${maxTemplateAttempts} - Generating fresh ${templateSize} template... (${(elapsed / 1000).toFixed(1)}s elapsed)`);
      const templateStartTime = Date.now();
      
      this.templates = [];
      this.addGeneratedTemplate(config.difficulty);
      
      if (this.templates.length === 0) {
        console.log(`   ⚠️  Failed to generate template, skipping...`);
        continue;
      }
      
      const template = this.templates[0];
      const templateTime = Date.now() - templateStartTime;
      const density = ((template.slots.length * 4) / (template.rows * template.cols) * 100).toFixed(1);
      console.log(`   📋 Template: ${template.slots.length} slots, ${template.rows}x${template.cols} grid, ~${density}% density (${templateTime}ms)`);
      
      // Only proceed if template has reasonable density
      // Minimum slots scale with grid size (all 11x11 or larger now)
      const minSlots = config.difficulty === Difficulty.EASY ? 20 :      // 11x11 medium
                       config.difficulty === Difficulty.MEDIUM ? 20 :    // 11x11 medium
                       config.difficulty === Difficulty.CHALLENGING ? 50 : // 14x14 small
                       80;                                                // 15x15 large
      if (template.slots.length < minSlots) {
        console.log(`   ⚠️  Template too sparse (${template.slots.length} slots, need ${minSlots}), trying again...`);
        continue;
      }
      
      console.log(`   🧩 Attempting to solve ultra-dense template with 6M clues...`);
      const solveStartTime = Date.now();
      const puzzle = this.generateFromTemplate(0, {
        title: `${config.title}`,
        difficulty: config.difficulty,
        category: config.category
      });
      const solveTime = Date.now() - solveStartTime;
      console.log(`   ⏱️  Solve attempt took ${solveTime}ms`);
      
      if (puzzle) {
        console.log(`\n✅ SUCCESS! Generated perfect puzzle: "${puzzle.title}"`);
        console.log(`   Grid: ${puzzle.grid.rows}x${puzzle.grid.cols}`);
        console.log(`   Clues: ${puzzle.clues.length}`);
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

  /**
   * Generate multiple puzzle variants
   */
  generateBatch(
    count: number,
    config: {
      difficulty: Difficulty;
      category: string;
      titlePrefix: string;
    }
  ): Puzzle[] {
    const puzzles: Puzzle[] = [];
    let attempts = 0;
    const maxAttempts = count * 20; // Increased from count * 5
    
    while (puzzles.length < count && attempts < maxAttempts) {
      attempts++;
      
      const templateIndex = Math.floor(Math.random() * this.templates.length);
      const puzzle = this.generateFromTemplate(templateIndex, {
        title: `${config.titlePrefix} #${puzzles.length + 1}`,
        difficulty: config.difficulty,
        category: config.category
      });
      
      if (puzzle) {
        puzzles.push(puzzle);
        console.log(`Generated puzzle ${puzzles.length}/${count}`);
      } else if (attempts % 10 === 0) {
        // Log progress every 10 attempts
        console.log(`Attempt ${attempts}/${maxAttempts}...`);
      }
    }
    
    console.log(`Generated ${puzzles.length} puzzles in ${attempts} attempts`);
    if (puzzles.length < count) {
      console.log(`⚠️  Warning: Only generated ${puzzles.length} out of ${count} requested puzzles`);
    }
    return puzzles;
  }
}

/**
 * Generate puzzles using the generator
 * This function can be called from seedPuzzles.ts
 */
/**
 * Now respects difficulty setting for word and clue selection
 */
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
  
  // Create generator with appropriate difficulty - this filters the word pool!
  const generator = new PuzzleGenerator(difficulty);


  generator.addGeneratedTemplates();
  
  const puzzle = generator.generatePuzzle({
    difficulty: difficulty,
    category: config.category || 'Daily Life',
    title: config.title || 'Generated Puzzle'
  });
  
  if (puzzle) {
    console.log('\n' + '='.repeat(60));
    console.log('✅ PUZZLE GENERATED:');
    console.log('='.repeat(60));
    console.log(`  Title: ${puzzle.title}`);
    console.log(`  Grid: ${puzzle.grid.rows}x${puzzle.grid.cols}`);
    console.log(`  Clues: ${puzzle.clues.length}`);
    console.log(`  Difficulty: ${puzzle.difficulty} (clues filtered to ${clueDifficulty})`);
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