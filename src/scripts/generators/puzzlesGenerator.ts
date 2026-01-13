import { Difficulty } from '../../types';
import CLUES from '../core/clues';
import {
  Puzzle,
  GridTemplate,
} from '../core/types';

import {
  createTemplateFromPuzzle,
  solveGrid,
  buildCrossingIndex,
  CrossingIndex,
  generatePuzzleFromGrid,
  ClueDatabase,
  generateTemplate,
} from './grid-generator';

/**
 * Get a clue for a word
 */
function getClue(word: string, difficulty: Difficulty = Difficulty.EASY): string {
  const clues = CLUES[word.toUpperCase()];
  if (clues && clues.length > 0) {
    // Pick a random clue from available options
    return clues[Math.floor(Math.random() * clues.length)];
  }
  // Fallback
  return `[${word}]`;
}

/**
 * Get all available clues for a word
 */
function getAllClues(word: string, difficulty: Difficulty = Difficulty.EASY): string[] {
  const clues = CLUES[word.toUpperCase()];
  if (clues && clues.length > 0) {
    return clues;
  }
  // Fallback
  return [`[${word}]`];
}

const GOOD_TEMPLATE: Puzzle = {
  title: "Good Example",
  difficulty: Difficulty.EASY,
  category: "Daily Life",
  grid: { rows: 11, cols: 9 },
  clues: [
    { number: 1, direction: 'right-down', clue: 'Ensure', answer: 'SEE', enumeration: [3], startRow: 0, startCol: 0 },
    { number: 2, direction: 'down', clue: 'Private', answer: 'PERSONAL', enumeration: [8], startRow: 0, startCol: 2 },
    { number: 3, direction: 'left-down', clue: 'Stores', answer: 'FILES', enumeration: [5], startRow: 0, startCol: 4 },
    { number: 4, direction: 'left-down', clue: 'Roman marketplace', answer: 'FORUM', enumeration: [5], startRow: 0, startCol: 6 },
    { number: 5, direction: 'left-down', clue: 'Second Greek letter', answer: 'BETA', enumeration: [4], startRow: 0, startCol: 8 },
    { number: 6, direction: 'across', clue: 'Incidents', answer: 'EPISODES', enumeration: [8], startRow: 1, startCol: 0 },
    { number: 7, direction: 'down', clue: 'Strip', answer: 'GUR', enumeration: [3], startRow: 2, startCol: 4 },
    { number: 8, direction: 'down', clue: 'Loan', answer: 'LEND', enumeration: [4], startRow: 2, startCol: 6 },
    { number: 9, direction: 'down', clue: 'Fury', answer: 'RAGE', enumeration: [4], startRow: 2, startCol: 8 },
    { number: 10, direction: 'up-across', clue: 'Touch', answer: 'FEEL', enumeration: [4], startRow: 3, startCol: 0 },
    { number: 11, direction: 'across', clue: 'Usual', answer: 'REGULAR', enumeration: [7], startRow: 3, startCol: 1 },
    { number: 12, direction: 'across', clue: 'Take for granted', answer: 'ASSUME', enumeration: [6], startRow: 4, startCol: 0 },
    { number: 13, direction: 'down', clue: 'Assert', answer: 'ALLEGE', enumeration: [6], startRow: 4, startCol: 7 },
    { number: 14, direction: 'down-across', clue: 'Short skirt', answer: 'MINI', enumeration: [4], startRow: 5, startCol: 0 },
    { number: 15, direction: 'down', clue: 'Units', answer: 'ITEMS', enumeration: [5], startRow: 5, startCol: 1 },
    { number: 16, direction: 'down', clue: 'Deduce', answer: 'INFER', enumeration: [5], startRow: 5, startCol: 3 },
    { number: 17, direction: 'across', clue: 'Pester', answer: 'NAG', enumeration: [3], startRow: 5, startCol: 5 },
    { number: 18, direction: 'across', clue: 'Lazy', answer: 'IDLE', enumeration: [4], startRow: 6, startCol: 4 },
    { number: 19, direction: 'across', clue: 'Large basin', answer: 'TANK', enumeration: [4], startRow: 7, startCol: 0 },
    { number: 20, direction: 'down', clue: 'Kitchen container', answer: 'POT', enumeration: [3], startRow: 7, startCol: 5 },
    { number: 21, direction: 'down', clue: 'Belonging to us', answer: 'OUR', enumeration: [3], startRow: 7, startCol: 6 },
    { number: 22, direction: 'down', clue: 'Definite article', answer: 'THE', enumeration: [3], startRow: 7, startCol: 8 },
    { number: 23, direction: 'across', clue: 'Fairy', answer: 'ELF', enumeration: [3], startRow: 8, startCol: 0 },
    { number: 24, direction: 'across', clue: 'Bard', answer: 'POET', enumeration: [4], startRow: 8, startCol: 4 },
    { number: 25, direction: 'down-across', clue: 'Operator', answer: 'USER', enumeration: [4], startRow: 9, startCol: 0 },
    { number: 26, direction: 'across', clue: 'Sufficient', answer: 'ENOUGH', enumeration: [6], startRow: 9, startCol: 2 },
    { number: 27, direction: 'across', clue: 'Woody plant', answer: 'TREE', enumeration: [4], startRow: 10, startCol: 4 }
  ],
  estimatedTime: 90,
  coinReward: 10
};


// ============================================================================
// MAIN GENERATOR CLASS
// ============================================================================

export class PuzzleGenerator {
  private wordIndex: CrossingIndex;
  private templates: GridTemplate[] = [];
  
  constructor() {
    // Build word index for fast lookups
    this.wordIndex = buildCrossingIndex(Object.keys(CLUES).map(key => key.toUpperCase()));
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
  addGeneratedTemplate(size: 'small' | 'medium' | 'large' | 'xlarge', difficulty: Difficulty = Difficulty.EASY): void {
    const template = generateTemplate(size, difficulty);
    
    // Validate template has minimum required slots
    const minSlots = size === 'medium' ? 18 : size === 'small' ? 35 : size === 'large' ? 65 : 55;
    if (template.slots.length < minSlots) {
      console.warn(`⚠️  Skipping template: Only ${template.slots.length} slots (need ${minSlots} for ${size})`);
      return; // Don't add invalid templates
    }
    
    this.templates.push(template);
    console.log(`Generated template: ${template.name} (${template.rows}x${template.cols}, ${template.slots.length} slots)`);
  }
  
  /**
   * Add multiple generated templates of different sizes
   */
  addGeneratedTemplates(): void {
    // Use 'medium' for much better solvability (smaller = easier)
    this.addGeneratedTemplate('medium', Difficulty.MEDIUM);
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
    
    // Reasonable compute limits with progress tracking
    const slotCount = template.slots.length;
    const baseAttempts = 30000; // Further reduced for faster iteration
    const attemptsPerSlot = 1000; // Further reduced
    const maxAttempts = Math.min(baseAttempts + (slotCount * attemptsPerSlot), 100000); // Cap at 100k
    
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
      estimatedTime: config.difficulty === Difficulty.EASY ? 60 : 
                     config.difficulty === Difficulty.MEDIUM ? 90 : 120,
      coinReward: config.difficulty === Difficulty.EASY ? 10 :
                    config.difficulty === Difficulty.MEDIUM ? 15 : 20
      }
    );

    return puzzle;
  }
  
  /**
   * Generate ONE perfect puzzle with maximum compute power
   * Generates a NEW template for each attempt until we get a solvable puzzle
   */
  generateOnePerfect(
    config: {
      difficulty: Difficulty;
      category: string;
      title: string;
    }
  ): Puzzle | null {
    console.log('🎯 Generating ONE perfect puzzle with maximum compute power...');
    let attempts = 0;
    const maxTemplateAttempts = 10; // Reduced from 30 - faster iteration
    const maxTotalTime = 5 * 60 * 1000; // 5 minutes max total time
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
      console.log(`\n🔄 Attempt ${attempts}/${maxTemplateAttempts} - Generating fresh template... (${(elapsed / 1000).toFixed(1)}s elapsed)`);
      const templateStartTime = Date.now();
      
      // Clear old templates and generate a new one
      // Use 'medium' for much better solvability (smaller grid = easier to solve)
      this.templates = [];
      this.addGeneratedTemplate('medium', config.difficulty);
      
      if (this.templates.length === 0) {
        console.log(`   ⚠️  Failed to generate template, skipping...`);
        continue;
      }
      
      const template = this.templates[0];
      const templateTime = Date.now() - templateStartTime;
      console.log(`   📋 Template: ${template.slots.length} slots, ${template.rows}x${template.cols} grid (${templateTime}ms)`);
      
      console.log(`   🧩 Attempting to solve template...`);
      const solveStartTime = Date.now();
      const puzzle = this.generateFromTemplate(0, {
        title: `${config.title} (Attempt ${attempts})`,
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
 */
export function generateOnePerfectPuzzle(
  config: {
    difficulty?: Difficulty;
    category?: string;
    title?: string;
  } = {}
): Puzzle | null {
  console.log('='.repeat(60));
  console.log('🎯 PERFECT PUZZLE GENERATOR - Maximum Compute Power');
  console.log('='.repeat(60));
  
  // Create generator
  const generator = new PuzzleGenerator();

  // Add programmatically generated templates for bigger, more complex puzzles
  generator.addGeneratedTemplates();
  
  const puzzle = generator.generateOnePerfect({
    difficulty: config.difficulty || Difficulty.MEDIUM,
    category: config.category || 'Daily Life',
    title: config.title || 'Perfect Puzzle'
  });
  
  if (puzzle) {
    console.log('\n' + '='.repeat(60));
    console.log('✅ PERFECT PUZZLE GENERATED:');
    console.log('='.repeat(60));
    console.log(`  Title: ${puzzle.title}`);
    console.log(`  Grid: ${puzzle.grid.rows}x${puzzle.grid.cols}`);
    console.log(`  Clues: ${puzzle.clues.length}`);
    console.log(`  Difficulty: ${puzzle.difficulty}`);
    console.log(`  Category: ${puzzle.category}`);
    console.log(`  Estimated Time: ${puzzle.estimatedTime} minutes`);
    console.log(`  Coin Reward: ${puzzle.coinReward}`);
  } else {
    console.log('\n❌ Failed to generate perfect puzzle');
  }
  
  return puzzle;
}

export function generatePuzzles(
  count: number = 20,
  config: {
    difficulty?: Difficulty;
    category?: string;
    titlePrefix?: string;
  } = {}
): Puzzle[] {
  console.log('='.repeat(60));
  console.log('Swedish Arrow Crossword Puzzle Generator');
  console.log('='.repeat(60));
  
  // Create generator
  const generator = new PuzzleGenerator();

  // Add simple validated templates (if they exist)
  // Note: These templates may not exist, so we'll use programmatic generation instead
  
  // Add programmatically generated templates for bigger, more complex puzzles
  generator.addGeneratedTemplates();
  
  const puzzles: Puzzle[] = [];
  puzzles.push(...generator.generateBatch(count, {
    difficulty: config.difficulty || Difficulty.EASY,
    category: config.category || 'Daily Life',
    titlePrefix: config.titlePrefix || 'Generated Puzzle'
  }));
  // Output results
  console.log('\n' + '='.repeat(60));
  console.log(`Generated ${puzzles.length} Puzzles:`);
  console.log('='.repeat(60));
  
  for (const puzzle of puzzles) {
    console.log(`  ✓ ${puzzle.title}: ${puzzle.grid.rows}x${puzzle.grid.cols}, ${puzzle.clues.length} clues`);
  }
  
  return puzzles;
}

export { 
  GOOD_TEMPLATE,
  getClue 
};