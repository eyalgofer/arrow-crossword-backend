import { Difficulty } from '../../types';
import {
  Puzzle,
  GridTemplate,
} from '../core/types';

import { createTemplateFromPuzzle, generatePuzzleFromGrid, ClueDatabase } from './puzzle-assembler';
import { solveGrid } from './grid-solver';
import { buildCrossingIndex, CrossingIndex } from './word-index';
import { generateTemplate } from './template-generator';

import { getCluesDatabase, getClueForWord, getCluesFiltered, getWordsForDifficulty } from '../core/cluesFromCSV';
import { ClueDifficulty } from '../core/wordFrequency';

// Load clues database (with difficulty classification)
const CLUES_DB = getCluesDatabase();

/**
 * Map puzzle Difficulty to clue ClueDifficulty
 */
function mapDifficulty(difficulty: Difficulty): ClueDifficulty {
  switch (difficulty) {
    case Difficulty.EASY:
      return 'easy';
    case Difficulty.MEDIUM:
      return 'medium';
    case Difficulty.HARD:
    default:
      return 'hard';
  }
}

/**
 * Get a clue for a word, filtered by difficulty
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
 */
function getAllClues(word: string, difficulty: Difficulty = Difficulty.EASY): string[] {
  const clueDifficulty = mapDifficulty(difficulty);
  const normalizedWord = word.toUpperCase().replace(/\s+/g, '');
  const entries = CLUES_DB.byAnswer[normalizedWord];
  
  if (!entries || entries.length === 0) {
    return [`[${word}]`];
  }
  
  // Filter by difficulty - for easy, prefer easy clues; for medium, include easy+medium
  const allowedDifficulties: Set<ClueDifficulty> = new Set(['easy']);
  if (clueDifficulty === 'medium' || clueDifficulty === 'hard') {
    allowedDifficulties.add('medium');
  }
  if (clueDifficulty === 'hard') {
    allowedDifficulties.add('hard');
  }
  
  const filteredClues = entries
    .filter(e => allowedDifficulties.has(e.difficulty))
    .map(e => e.clue);
  
  if (filteredClues.length > 0) {
    return filteredClues;
  }
  
  // Fallback to any available clue
  return entries.map(e => e.clue);
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
    const clueDifficulty = mapDifficulty(difficulty);
    const words = getWordsForDifficulty(clueDifficulty);
    
    console.log(`📚 Building word index for ${clueDifficulty.toUpperCase()} difficulty: ${words.length.toLocaleString()} words available`);
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
  addGeneratedTemplate(size: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge', difficulty: Difficulty = Difficulty.EASY): void {
    const template = generateTemplate(size, difficulty);
    
    // Validate template has minimum required slots
    // Scale minimums based on template size
    const minSlots = size === 'tiny' ? 6 : size === 'small' ? 12 : size === 'medium' ? 18 : size === 'large' ? 50 : 55;
    if (template.slots.length < minSlots) {
      console.warn(`⚠️  Skipping template: Only ${template.slots.length} slots (need ${minSlots} for ${size})`);
      return; // Don't add invalid templates
    }
    
    this.templates.push(template);
    console.log(`Generated template: ${template.name} (${template.rows}x${template.cols}, ${template.slots.length} slots)`);
  }
  
  /**
   * Add multiple generated templates of different sizes
   * Template size is based on difficulty and available word count
   */
  addGeneratedTemplates(): void {
    // Choose template size based on difficulty
    // EASY has only ~1,700 words, needs tiny 7x7 templates
    // MEDIUM has ~200k words, can handle medium 11x11 templates  
    // HARD has ~400k words, can handle large 15x15 templates
    const size: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge' = 
      this.difficulty === Difficulty.EASY ? 'tiny' : 
      this.difficulty === Difficulty.MEDIUM ? 'medium' : 'large';
    this.addGeneratedTemplate(size, this.difficulty);
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
      // Template size is based on difficulty (EASY = tiny 7x7, MEDIUM = medium 11x11, HARD = large 15x15)
      const templateSize: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge' = 
        config.difficulty === Difficulty.EASY ? 'tiny' : 
        config.difficulty === Difficulty.MEDIUM ? 'medium' : 'large';
      console.log(`\n🔄 Attempt ${attempts}/${maxTemplateAttempts} - Generating fresh ${templateSize} template... (${(elapsed / 1000).toFixed(1)}s elapsed)`);
      const templateStartTime = Date.now();
      
      this.templates = [];
      this.addGeneratedTemplate(templateSize, config.difficulty);
      
      if (this.templates.length === 0) {
        console.log(`   ⚠️  Failed to generate template, skipping...`);
        continue;
      }
      
      const template = this.templates[0];
      const templateTime = Date.now() - templateStartTime;
      const density = ((template.slots.length * 4) / (template.rows * template.cols) * 100).toFixed(1);
      console.log(`   📋 Template: ${template.slots.length} slots, ${template.rows}x${template.cols} grid, ~${density}% density (${templateTime}ms)`);
      
      // Only proceed if template has reasonable density
      // Minimum slots scale with difficulty: EASY=6 (tiny grid), MEDIUM=20, HARD=40
      const minSlots = config.difficulty === Difficulty.EASY ? 6 : 
                       config.difficulty === Difficulty.MEDIUM ? 20 : 40;
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
 * Generate ONE perfect puzzle with maximum compute power
 * Now respects difficulty setting for word and clue selection!
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

  // Add programmatically generated templates for bigger, more complex puzzles
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