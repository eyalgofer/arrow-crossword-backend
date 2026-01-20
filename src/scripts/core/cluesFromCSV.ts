import * as fs from 'fs';
import * as path from 'path';
import { classifyClue, ClueDifficulty, ClueWithDifficulty, isCommonWord } from './wordFrequency';

/**
 * Clue entry with difficulty classification
 */
export interface ClueEntry {
  clue: string;
  difficulty: ClueDifficulty;
}

/**
 * Clues database organized by answer word
 */
export interface CluesDatabase {
  // All clues grouped by answer
  byAnswer: Record<string, ClueEntry[]>;
  // Words that have easy clues available
  easyWords: Set<string>;
  // Words that have medium clues available
  mediumWords: Set<string>;
  // Statistics
  stats: {
    totalWords: number;
    totalClues: number;
    easyClues: number;
    mediumClues: number;
    hardClues: number;
  };
}

/**
 * Load clues from train.csv file with difficulty classification
 * CSV format: id,clue,answer,difficulty (difficulty column may be empty)
 * Groups clues by answer (word) in uppercase, removing spaces for matching
 */
export function loadCluesFromCSV(): CluesDatabase {
  const csvPath = path.join(__dirname, 'train.csv');
  const database: CluesDatabase = {
    byAnswer: {},
    easyWords: new Set(),
    mediumWords: new Set(),
    stats: {
      totalWords: 0,
      totalClues: 0,
      easyClues: 0,
      mediumClues: 0,
      hardClues: 0,
    }
  };
  
  console.log(`📖 Loading clues from ${csvPath} with difficulty classification...`);
  const startTime = Date.now();
  
  try {
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n');
    
    let processed = 0;
    const batchSize = 100000;
    
    // Skip header line (id,clue,answer,difficulty)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse CSV line - handle quoted fields
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          if (j + 1 < line.length && line[j + 1] === '"') {
            current += '"';
            j++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          parts.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current);
      
      if (parts.length >= 3) {
        const clueText = parts[1].trim();
        const answerRaw = parts[2].trim();
        // Normalize answer: uppercase, remove spaces for matching
        const answer = answerRaw.toUpperCase().replace(/\s+/g, '');
        
        if (answer && clueText) {
          // Classify the clue difficulty
          const difficulty = classifyClue(clueText, answerRaw);
          
          if (!database.byAnswer[answer]) {
            database.byAnswer[answer] = [];
          }
          
          database.byAnswer[answer].push({
            clue: clueText,
            difficulty
          });
          
          // Track which words have easy/medium clues
          if (difficulty === 'easy') {
            database.easyWords.add(answer);
            database.stats.easyClues++;
          } else if (difficulty === 'medium') {
            database.mediumWords.add(answer);
            database.stats.mediumClues++;
          } else {
            database.stats.hardClues++;
          }
          
          database.stats.totalClues++;
        }
      }
      
      processed++;
      if (processed % batchSize === 0) {
        const elapsed = Date.now() - startTime;
        console.log(`   Processed ${processed.toLocaleString()} lines (${(elapsed / 1000).toFixed(1)}s)...`);
      }
    }
    
    database.stats.totalWords = Object.keys(database.byAnswer).length;
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Loaded ${database.stats.totalWords.toLocaleString()} words with ${database.stats.totalClues.toLocaleString()} total clues (${(elapsed / 1000).toFixed(1)}s)`);
    console.log(`   📊 Difficulty breakdown:`);
    console.log(`      Easy: ${database.stats.easyClues.toLocaleString()} clues (${database.easyWords.size.toLocaleString()} words)`);
    console.log(`      Medium: ${database.stats.mediumClues.toLocaleString()} clues (${database.mediumWords.size.toLocaleString()} words)`);
    console.log(`      Hard: ${database.stats.hardClues.toLocaleString()} clues`);
    
    return database;
  } catch (error) {
    console.error(`❌ Error loading clues from CSV:`, error);
    throw error;
  }
}

// Cache the loaded database
let cachedDatabase: CluesDatabase | null = null;

/**
 * Get the clues database, loading from CSV if not already cached
 */
export function getCluesDatabase(): CluesDatabase {
  if (!cachedDatabase) {
    cachedDatabase = loadCluesFromCSV();
  }
  return cachedDatabase;
}

/**
 * Legacy function for backward compatibility
 * Returns clues in the old format (just string arrays)
 */
export function getClues(): Record<string, string[]> {
  const db = getCluesDatabase();
  const result: Record<string, string[]> = {};
  
  for (const [answer, entries] of Object.entries(db.byAnswer)) {
    result[answer] = entries.map(e => e.clue);
  }
  
  return result;
}

/**
 * Get clues filtered by maximum difficulty
 * @param maxDifficulty - 'easy' returns only easy, 'medium' returns easy+medium, 'hard' returns all
 */
export function getCluesFiltered(maxDifficulty: ClueDifficulty): Record<string, string[]> {
  const db = getCluesDatabase();
  const result: Record<string, string[]> = {};
  
  const allowedDifficulties: Set<ClueDifficulty> = new Set(['easy']);
  if (maxDifficulty === 'medium' || maxDifficulty === 'hard') {
    allowedDifficulties.add('medium');
  }
  if (maxDifficulty === 'hard') {
    allowedDifficulties.add('hard');
  }
  
  for (const [answer, entries] of Object.entries(db.byAnswer)) {
    const filteredClues = entries
      .filter(e => allowedDifficulties.has(e.difficulty))
      .map(e => e.clue);
    
    if (filteredClues.length > 0) {
      result[answer] = filteredClues;
    }
  }
  
  return result;
}

/**
 * Get a single clue for a word, preferring easier clues based on difficulty setting
 */
export function getClueForWord(
  word: string, 
  preferDifficulty: ClueDifficulty = 'medium'
): string | null {
  const db = getCluesDatabase();
  const normalizedWord = word.toUpperCase().replace(/\s+/g, '');
  const entries = db.byAnswer[normalizedWord];
  
  if (!entries || entries.length === 0) {
    return null;
  }
  
  // Sort entries by difficulty preference
  const difficultyOrder: Record<ClueDifficulty, number> = {
    easy: preferDifficulty === 'easy' ? 0 : (preferDifficulty === 'medium' ? 1 : 2),
    medium: preferDifficulty === 'medium' ? 0 : 1,
    hard: preferDifficulty === 'hard' ? 0 : 2,
  };
  
  // Group by difficulty
  const byDiff: Record<ClueDifficulty, string[]> = { easy: [], medium: [], hard: [] };
  for (const entry of entries) {
    byDiff[entry.difficulty].push(entry.clue);
  }
  
  // Pick from preferred difficulty first, then fall back
  const order: ClueDifficulty[] = preferDifficulty === 'easy' 
    ? ['easy', 'medium', 'hard']
    : preferDifficulty === 'medium'
    ? ['medium', 'easy', 'hard']
    : ['hard', 'medium', 'easy'];
  
  for (const diff of order) {
    if (byDiff[diff].length > 0) {
      // Pick a random clue from this difficulty
      return byDiff[diff][Math.floor(Math.random() * byDiff[diff].length)];
    }
  }
  
  return entries[0].clue;
}

/**
 * Get words that are suitable for a given difficulty level
 */
export function getWordsForDifficulty(difficulty: ClueDifficulty): string[] {
  const db = getCluesDatabase();
  
  if (difficulty === 'easy') {
    // Only words that have easy clues AND are common words
    return Array.from(db.easyWords).filter(word => isCommonWord(word));
  } else if (difficulty === 'medium') {
    // Words that have easy or medium clues
    return [...db.easyWords, ...db.mediumWords];
  } else {
    // All words
    return Object.keys(db.byAnswer);
  }
}
