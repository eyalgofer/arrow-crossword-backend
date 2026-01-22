import * as fs from 'fs';
import * as path from 'path';

export type ClueDifficulty = 'easy' | 'medium' | 'challenging' | 'hard' | 'expert';

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
  // Mapping from normalized answer (no spaces) to original answer (with spaces)
  originalAnswers: Map<string, string>;
  // Words that have easy clues available
  easyWords: Set<string>;
  // Words that have medium clues available
  mediumWords: Set<string>;
  // Words that have challenging clues available
  challengingWords: Set<string>;
  // Statistics
  stats: {
    totalWords: number;
    totalClues: number;
    easyClues: number;
    mediumClues: number;
    challengingClues: number;
    hardClues: number;
    expertClues: number;
  };
}

/**
 * Map CSV difficulty number to ClueDifficulty
 * 1=easy, 2=medium, 3=challenging, 4=hard, 5=expert
 */
function mapCsvDifficulty(difficultyNum: number): ClueDifficulty {
  switch (difficultyNum) {
    case 1: return 'easy';
    case 2: return 'medium';
    case 3: return 'challenging';
    case 4: return 'hard';
    case 5: return 'expert';
    default: return 'medium'; // Default to medium if unknown
  }
}

/**
 * Load clues from train.csv file with difficulty from CSV column
 * CSV format: id,clue,answer,empty,difficulty (difficulty is 1-5)
 * Groups clues by answer (word) in uppercase, removing spaces for matching
 */
export function loadCluesFromCSV(): CluesDatabase {
  const csvPath = path.join(__dirname, 'train.csv');
  const database: CluesDatabase = {
    byAnswer: {},
    originalAnswers: new Map(),
    easyWords: new Set(),
    mediumWords: new Set(),
    challengingWords: new Set(),
    stats: {
      totalWords: 0,
      totalClues: 0,
      easyClues: 0,
      mediumClues: 0,
      challengingClues: 0,
      hardClues: 0,
      expertClues: 0,
    }
  };
  
  console.log(`📖 Loading clues from ${csvPath} with CSV difficulty column...`);
  const startTime = Date.now();
  
  try {
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n');
    
    let processed = 0;
    const batchSize = 100000;
    
    // Skip header line (id,clue,answer,empty,difficulty)
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
        // Preserve original answer format (uppercase but with spaces)
        const originalAnswer = answerRaw.toUpperCase();
        
        // Get difficulty from CSV column (index 4, the last column with value)
        // CSV has: id,clue,answer,empty,difficulty
        const difficultyNum = parts.length >= 5 ? parseInt(parts[4].trim(), 10) : 0;
        
        if (answer && clueText) {
          const filters = ['___', '...'];
          if (filters.some(filter => clueText.includes(filter))) {
            continue; // Skip filtered clues
          }
          

          const difficulty: ClueDifficulty = difficultyNum >= 1 && difficultyNum <= 5
            ? mapCsvDifficulty(difficultyNum)
            : 'medium';
          
          if (!database.byAnswer[answer]) {
            database.byAnswer[answer] = [];
          }
          
          // Store mapping from normalized to original answer format
          database.originalAnswers.set(answer, originalAnswer);
          
          database.byAnswer[answer].push({
            clue: clueText,
            difficulty
          });
          
          // Track which words have clues at each difficulty
          switch (difficulty) {
            case 'easy':
              database.easyWords.add(answer);
              database.stats.easyClues++;
              break;
            case 'medium':
              database.mediumWords.add(answer);
              database.stats.mediumClues++;
              break;
            case 'challenging':
              database.challengingWords.add(answer);
              database.stats.challengingClues++;
              break;
            case 'hard':
              database.stats.hardClues++;
              break;
            case 'expert':
              database.stats.expertClues++;
              break;
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
    console.log(`   📊 Difficulty breakdown (from CSV):`);
    console.log(`      Easy (1): ${database.stats.easyClues.toLocaleString()} clues (${database.easyWords.size.toLocaleString()} words)`);
    console.log(`      Medium (2): ${database.stats.mediumClues.toLocaleString()} clues (${database.mediumWords.size.toLocaleString()} words)`);
    console.log(`      Challenging (3): ${database.stats.challengingClues.toLocaleString()} clues (${database.challengingWords.size.toLocaleString()} words)`);
    console.log(`      Hard (4): ${database.stats.hardClues.toLocaleString()} clues`);
    console.log(`      Expert (5): ${database.stats.expertClues.toLocaleString()} clues`);
    
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
 * Get a single clue for a word, preferring easier clues based on difficulty setting
 * For puzzle packages, we only want easy/medium/challenging (no hard/expert)
 */
export function getClueForWord(
  word: string, 
  preferDifficulty: ClueDifficulty = 'medium',
  maxDifficulty: ClueDifficulty = 'challenging'
): string | null {
  const db = getCluesDatabase();
  const normalizedWord = word.toUpperCase().replace(/\s+/g, '');
  const entries = db.byAnswer[normalizedWord];
  
  if (!entries || entries.length === 0) {
    return null;
  }
  
  // Build allowed difficulties based on max
  const difficultyOrder: ClueDifficulty[] = ['easy', 'medium', 'challenging', 'hard', 'expert'];
  const maxIndex = difficultyOrder.indexOf(maxDifficulty);
  const allowedDifficulties = new Set(difficultyOrder.slice(0, maxIndex + 1));
  
  // Group by difficulty (only allowed ones)
  const byDiff: Record<ClueDifficulty, string[]> = { 
    easy: [], medium: [], challenging: [], hard: [], expert: [] 
  };
  for (const entry of entries) {
    if (allowedDifficulties.has(entry.difficulty)) {
      byDiff[entry.difficulty].push(entry.clue);
    }
  }
  
  for (const diff of allowedDifficulties) {
    if (byDiff[diff].length > 0) {
      // Pick a random clue from this difficulty
      return byDiff[diff][Math.floor(Math.random() * byDiff[diff].length)];
    }
  }
  
  // If no clue found in allowed difficulties, return null
  return null;
}

/**
 * Get words that have clues at or below the specified max difficulty
 * This is used for puzzle generation to ensure all words have valid clues
 */
export function getWordsWithMaxDifficulty(maxDifficulty: ClueDifficulty): string[] {
  const db = getCluesDatabase();
  const difficultyOrder: ClueDifficulty[] = ['easy', 'medium', 'challenging', 'hard', 'expert'];
  let maxIndex = difficultyOrder.indexOf(maxDifficulty);
  
  if (maxIndex === -1) {
    console.error(`❌ Invalid difficulty '${maxDifficulty}' passed to getWordsWithMaxDifficulty. Valid values: ${difficultyOrder.join(', ')}`);
    console.warn(`   Falling back to 'medium' difficulty`);
    maxIndex = difficultyOrder.indexOf('medium'); // Fallback to medium
  }
  
  let allowedDifficulties: Set<ClueDifficulty>;
  if (maxDifficulty === 'easy') {
    allowedDifficulties = new Set(['easy', 'medium']);
  } else {
    allowedDifficulties = new Set(difficultyOrder.slice(0, maxIndex + 1));
  }
  
  const validWords: string[] = [];
  
  for (const [word, entries] of Object.entries(db.byAnswer)) {
    // Check if this word has at least one clue at an allowed difficulty
    const hasValidClue = entries.some(e => allowedDifficulties.has(e.difficulty));
    if (hasValidClue) {
      // Return original answer format (with spaces) instead of normalized
      const originalAnswer = db.originalAnswers.get(word) || word;
      validWords.push(originalAnswer);
    }
  }
  
  if (validWords.length === 0) {
    const totalWordsInDb = Object.keys(db.byAnswer).length;
    console.error(`❌ No words found for difficulty '${maxDifficulty}'. This is a critical error!`);
    console.error(`   Total words in database: ${totalWordsInDb}`);
    console.error(`   Allowed difficulties: ${Array.from(allowedDifficulties).join(', ')}`);
    // Show sample of what difficulties exist in the database
    const sampleEntries = Object.entries(db.byAnswer).slice(0, 10);
    console.error(`   Sample words and their difficulties:`);
    for (const [word, entries] of sampleEntries) {
      const difficulties = new Set(entries.map(e => e.difficulty));
      console.error(`     '${word}': [${Array.from(difficulties).join(', ')}]`);
    }
  }
  
  return validWords;
}
