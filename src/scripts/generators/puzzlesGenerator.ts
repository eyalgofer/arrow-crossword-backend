import { Difficulty } from '../../types';
import {
  Puzzle,
  GridTemplate,
} from '../core/types';

import { generatePuzzleFromGrid, ClueDatabase } from './puzzle-assembler';
import { solveGrid } from './grid-solver';
import { buildCrossingIndex, CrossingIndex } from './word-index';
import { generateTemplate } from './template-generator';

import { getClueForWord, getWordsWithMaxDifficulty, getWordsWithMaxDifficultyFromPreferredSourcesOnly, getTrainDatabase, getSynonymsDatabase } from '../core/cluesFromCSV';
import { normalizeWord } from './validation-utils';

export type ClueDifficulty = 'easy' | 'medium' | 'challenging' | 'hard' | 'expert';

// Load clues databases (with difficulty classification)
const SYNONYMS_DB = getSynonymsDatabase();
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
 * For EASY puzzles: only uses synonyms.csv (no train.csv)
 * For other difficulties: tries synonyms.csv first, then train.csv
 */
function getClue(word: string, difficulty: Difficulty = Difficulty.EASY): string {
  // For easy puzzles, only use synonyms database
  if (difficulty === Difficulty.EASY) {
    const normalizedWord = normalizeWord(word);
    const entries = SYNONYMS_DB.byAnswer[normalizedWord];
    if (entries && entries.length > 0) {
      // Prefer easy/medium → challenging → hard/expert so we never show [answer] when a real clue exists
      const easyMedium = entries.filter(e => e.difficulty === 'easy' || e.difficulty === 'medium').map(e => e.clue);
      const challenging = entries.filter(e => e.difficulty === 'challenging').map(e => e.clue);
      const hardExpert = entries.filter(e => e.difficulty === 'hard' || e.difficulty === 'expert').map(e => e.clue);
      const pool = easyMedium.length > 0 ? easyMedium : challenging.length > 0 ? challenging : hardExpert;
      // Exclude clues that are the answer (e.g. "aba" for answer "aba") or answer in brackets
      const valid = pool.filter(c => {
        if (c === `[${normalizedWord}]` || c === `[${word}]`) return false;
        if (normalizeWord(c) === normalizedWord) return false;
        return true;
      });
      if (valid.length > 0) {
        return valid[Math.floor(Math.random() * valid.length)];
      }
    }
    return `[${word}]`;
  }
  
  // For other difficulties, use the standard function
  const clueDifficulty = mapDifficulty(difficulty);
  const clue = getClueForWord(word, clueDifficulty);
  return clue || `[${word}]`;
}

/**
 * Get all available clues for a word, filtered by difficulty
 * For EASY puzzles: only uses synonyms.csv with easy/medium clues (no train.csv, no hard/expert)
 * For other difficulties: tries synonyms.csv first, then train.csv
 */
function getAllClues(word: string, difficulty: Difficulty = Difficulty.EASY): string[] {
  const normalizedWord = normalizeWord(word);
  
  // For easy puzzles, synonyms only: prefer easy/medium → challenging → hard/expert so we never show [answer]
  if (difficulty === Difficulty.EASY) {
    const entries = SYNONYMS_DB.byAnswer[normalizedWord];
    if (!entries || entries.length === 0) return [`[${word}]`];
    
    const easyMediumClues = entries.filter(e => e.difficulty === 'easy' || e.difficulty === 'medium').map(e => e.clue);
    const challengingClues = entries.filter(e => e.difficulty === 'challenging').map(e => e.clue);
    const hardExpertClues = entries.filter(e => e.difficulty === 'hard' || e.difficulty === 'expert').map(e => e.clue);
    const pool = easyMediumClues.length > 0 ? easyMediumClues : challengingClues.length > 0 ? challengingClues : hardExpertClues;
    const valid = pool.filter(c => {
      if (c === `[${normalizedWord}]` || c === `[${word}]`) return false;
      if (normalizeWord(c) === normalizedWord) return false;
      return true;
    });
    return valid.length > 0 ? valid : [`[${word}]`];
  }
  
  // For other difficulties, use the standard logic
  const clueDifficulty = mapDifficulty(difficulty);
  const difficultyOrder: ClueDifficulty[] = ['easy', 'medium', 'challenging'];
  const preferredIndex = difficultyOrder.indexOf(clueDifficulty);
  const allowedDifficulties = new Set(difficultyOrder.slice(0, Math.max(preferredIndex + 1, 1)));
  
  const getCluesFromDb = (db: typeof SYNONYMS_DB): string[] => {
    const entries = db.byAnswer[normalizedWord];
    if (!entries || entries.length === 0) return [];
    
    const filtered = entries
      .filter(e => allowedDifficulties.has(e.difficulty))
      .map(e => e.clue);
    
    if (filtered.length > 0) return filtered;
    
    // Fallback to all allowed difficulties
    const allAllowed = new Set<ClueDifficulty>(['easy', 'medium', 'challenging', 'hard', 'expert']);
    return entries
      .filter(e => allAllowed.has(e.difficulty))
      .map(e => e.clue);
  };
  
  const synonymsClues = getCluesFromDb(SYNONYMS_DB);
  if (synonymsClues.length > 0) return synonymsClues;

  const trainClues = getCluesFromDb(TRAIN_DB);
  if (trainClues.length > 0) return trainClues;

  return [`[${word}]`];
}

export class PuzzleGenerator {
  private wordIndex: CrossingIndex;
  private templates: GridTemplate[] = [];
  private difficulty: Difficulty;
  /** Prefer synonyms (2) over simple (1) when solving so clues stay easier */
  private wordScorer: (word: string) => number;

  constructor(difficulty: Difficulty = Difficulty.MEDIUM) {
    this.difficulty = difficulty;

    const synonymsWords = new Set(Object.keys(SYNONYMS_DB.byAnswer));
    this.wordScorer = (word: string) => {
      const n = normalizeWord(word);
      if (synonymsWords.has(n)) return 2;
      return 0;
    };

    // Build word index for fast lookups.
    // For EASY puzzles: only use synonyms words (no train words) to ensure easier puzzles
    // For other difficulties: use broader pool including train words as fallback
    const clueDifficulty = mapDifficulty(difficulty);
    let words: string[];
    if (difficulty === Difficulty.EASY) {
      // For easy puzzles, use synonyms words up to challenging so solver has enough candidates; clues still prefer easy/medium
      words = getWordsWithMaxDifficultyFromPreferredSourcesOnly('challenging');
    } else {
      const indexDifficulty = clueDifficulty;
      words = getWordsWithMaxDifficulty(indexDifficulty);
    }

    if (words.length === 0) {
      throw new Error(`No words available for difficulty '${clueDifficulty}'. This indicates a problem with the clues database or difficulty filtering.`);
    }

    // For hard/expert puzzles, limit word pool to avoid stack overflow
    const MAX_WORDS_FOR_INDEX = 100000;
    if (words.length > MAX_WORDS_FOR_INDEX) {
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

  buildGeneratedTemplate(difficulty: Difficulty = Difficulty.MEDIUM, opts?: { quiet?: boolean; maxIterations?: number; rows?: number; cols?: number }): boolean {
    const rows = opts?.rows ?? 10;
    const cols = opts?.cols ?? 10;
    try {
      const template = generateTemplate({
        rows,
        cols,
        difficulty,
        name: 'New Generator Template',
        quiet: opts?.quiet ?? false,
        maxIterations: opts?.maxIterations,
        minPopulation: 5,
      });
      this.templates.push(template);
      return true;
    } catch (error) {
      if (!opts?.quiet) console.log(`   ⚠️  Template generation failed: ${error}`);
      return false;
    }
  }

  /**
   * Build templates and solve until we have count puzzles. If a template fails to solve
   * (e.g. time limit), we try a new template instead of reusing the same one.
   */
  generateBatch(config: {
    count: number;
    category: string;
    getTitle: (index: number) => string;
    rows?: number;
    cols?: number;
  }): Puzzle[] {
    const puzzles: Puzzle[] = [];
    const maxTemplates = 10; // cap to avoid infinite loop if templates are often unsolvable
    let templatesTried = 0;

    while (puzzles.length < config.count && templatesTried < maxTemplates) {
      templatesTried++;
      this.templates = [];
      // Scale iterations with grid size: 10x10 needs ~25; 13x13+ needs more to converge
      const rows = config.rows ?? 10;
      const cols = config.cols ?? 10;
      const cells = rows * cols;
      const maxIterations = Math.min(150, Math.max(25, Math.ceil(25 * (cells / 100))));
      const built = this.buildGeneratedTemplate(this.difficulty, {
        quiet: true,
        maxIterations,
        rows,
        cols,
      });
      if (!built || this.templates.length === 0) continue;

      const needed = config.count - puzzles.length;
      for (let i = 0; i < needed; i++) {
        const p = this.solveTemplate(0, {
          title: config.getTitle(puzzles.length),
          difficulty: this.difficulty,
          category: config.category,
        }, { quiet: true });
        if (p) puzzles.push(p);
      }
    }
    return puzzles;
  }
  
  solveTemplate(
    templateIndex: number = 0,
    config: {
      title: string;
      difficulty: Difficulty;
      category: string;
    },
    opts?: { quiet?: boolean }
  ): Puzzle | null {
    if (templateIndex >= this.templates.length) {
      throw new Error(`Template index ${templateIndex} out of bounds`);
    }
    
    const template = this.templates[templateIndex];

    const slotCount = template.slots.length;
    // Cap runtime so a single solve never hangs for minutes. Easy/small grids need more time to find a valid fill.
    const maxSolveTimeMs = 90 * 1000; // 90 seconds per solve (was 45s; easy 8x8 often needed more)
    const baseAttempts = 100000;
    const attemptsPerSlot = 8000;
    const maxAttempts = Math.min(baseAttempts + (slotCount * attemptsPerSlot), 500000);
    
    let result = solveGrid(template, this.wordIndex, {
      maxAttempts,
      maxSolveTimeMs,
      shuffleWords: true,
      preferCommonWords: true,
      allowWordReuse: true,
      wordScorer: this.wordScorer,
      quiet: opts?.quiet ?? false,
    });
    
    if (!result) {
      if (!opts?.quiet) console.log(`Failed to generate puzzle variant (template: ${template.name}, slots: ${template.slots.length})`);
      return null;
    }
    
    // Create clue source tracker (order: synonyms → train)
    const clueSourceTracker = { synonymsCount: 0, simpleCount: 0, trainCount: 0 };
    
    // Create clue database with tracker
    const clueDb: ClueDatabase = {
      getClue: (word: string, difficulty: Difficulty) => getClue(word, difficulty),
      getAllClues: (word: string, difficulty: Difficulty) => getAllClues(word, difficulty),
      tracker: clueSourceTracker,
      quiet: opts?.quiet ?? false
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


export function generatePuzzlesBatch(config: {
  difficulty: Difficulty;
  count: number;
  category: string;
  startIndex: number;
  rows?: number;
  cols?: number;
}): Puzzle[] {
  const gen = new PuzzleGenerator(config.difficulty);
  return gen.generateBatch({
    count: config.count,
    category: config.category,
    getTitle: (i) => `Puzzle ${config.startIndex + i}`,
    rows: config.rows,
    cols: config.cols,
  });
}

export {
  getClue 
};