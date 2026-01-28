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
  const mapping: Record<number, ClueDifficulty> = {
    1: 'easy',
    2: 'medium',
    3: 'challenging',
    4: 'hard',
    5: 'expert',
  };
  return mapping[difficultyNum] || 'medium';
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
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
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

/**
 * Validate and filter clue text
 */
function isValidClue(clueText: string): boolean {
  if (clueText.length > 50) return false;
  const filters = ['___', '...'];
  return !filters.some(filter => clueText.includes(filter));
}

/**
 * Update database stats for a difficulty
 */
function updateDifficultyStats(
  database: CluesDatabase,
  difficulty: ClueDifficulty,
  answer: string
): void {
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
}

/**
 * Load clues from a CSV file with difficulty from CSV column
 * CSV format: id,clue,answer,difficulty (for simple.csv) or id,clue,answer,empty,difficulty (for train.csv)
 * Groups clues by answer (word) in uppercase, removing spaces for matching
 */
function loadCluesFromCSVFile(csvPath: string, isSimpleCSV: boolean = false): CluesDatabase {
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
  
  console.log(`📖 Loading clues from ${path.basename(csvPath)} with CSV difficulty column...`);
  const startTime = Date.now();
  
  try {
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n');
    
    let processed = 0;
    const batchSize = 100000;
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = parseCSVLine(line);
      
      if (parts.length >= 3) {
        const clueText = parts[1];
        const answerRaw = parts[2];
        const answer = answerRaw.toUpperCase().replace(/\s+/g, '');
        const originalAnswer = answerRaw.toUpperCase();
        
        if (!answer || !clueText || !isValidClue(clueText)) continue;
        
        const difficultyIndex = isSimpleCSV ? 3 : 4;
        const difficultyNum = parts.length > difficultyIndex ? parseInt(parts[difficultyIndex], 10) : 0;
        const difficulty = mapCsvDifficulty(difficultyNum);
        
        if (!database.byAnswer[answer]) {
          database.byAnswer[answer] = [];
        }
        
        database.originalAnswers.set(answer, originalAnswer);
        database.byAnswer[answer].push({ clue: clueText, difficulty });
        updateDifficultyStats(database, difficulty, answer);
        database.stats.totalClues++;
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



// Cache the loaded databases
let cachedSynonymsDatabase: CluesDatabase | null = null;
let cachedSimpleDatabase: CluesDatabase | null = null;
let cachedTrainDatabase: CluesDatabase | null = null;
let cachedCombinedDatabase: CluesDatabase | null = null;

/**
 * Load synonyms.csv file which has format: Word,Term1,Term2,Term3,...
 * For each term, creates clue entries where other terms in the row are clues
 * All clues are set to difficulty 1 (easy)
 * All terms (Word, Term1, Term2, etc.) are added as valid words
 */
function loadSynonymsFromCSV(csvPath: string): CluesDatabase {
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

  console.log(`📖 Loading synonyms from ${path.basename(csvPath)}...`);
  const startTime = Date.now();

  try {
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n');

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = parseCSVLine(line);
      if (parts.length < 3) continue; // Need clue, answer, and difficulty

      const clueText = parts[0];
      const answerRaw = parts[1];
      const difficultyNum = parts.length > 2 ? parseInt(parts[2], 10) : 0;

      if (!answerRaw || !clueText || !isValidClue(clueText)) continue;

      const answer = answerRaw.toUpperCase().replace(/\s+/g, '');
      const originalAnswer = answerRaw.toUpperCase();
      const difficulty = mapCsvDifficulty(difficultyNum);

      if (!database.originalAnswers.has(answer)) {
        database.originalAnswers.set(answer, originalAnswer);
      }

      const isNewWord = !database.byAnswer[answer];
      if (isNewWord) {
        database.byAnswer[answer] = [];
        database.stats.totalWords++;
      }

      // Check for duplicate clue
      const exists = database.byAnswer[answer].some(
        e => e.clue === clueText && e.difficulty === difficulty
      );

      if (!exists) {
        database.byAnswer[answer].push({ clue: clueText, difficulty });
        updateDifficultyStats(database, difficulty, answer);
        database.stats.totalClues++;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`   ✅ Loaded ${database.stats.totalWords.toLocaleString()} words with ${database.stats.totalClues.toLocaleString()} clues`);
    console.log(`      Easy: ${database.stats.easyClues.toLocaleString()}, Medium: ${database.stats.mediumClues.toLocaleString()}, Challenging: ${database.stats.challengingClues.toLocaleString()}, Hard: ${database.stats.hardClues.toLocaleString()}, Expert: ${database.stats.expertClues.toLocaleString()}`);
    console.log(`   ⏱️  Took ${elapsed}ms`);

    return database;
  } catch (error) {
    console.error(`❌ Error loading synonyms from ${csvPath}:`, error);
    throw error;
  }
}

/**
 * Load clues from both simple.csv (preferred) and train.csv (fallback)
 * Simple.csv is tried first, then train.csv as fallback
 */
export function loadCluesFromCSV(): CluesDatabase {
  const synonymsPath = path.join(__dirname, 'synonyms.csv');
  const trainPath = path.join(__dirname, 'train.csv');
  
  // Load synonyms.csv with special handler
  const synonymsDb = loadSynonymsFromCSV(synonymsPath);
  const trainDb = loadCluesFromCSVFile(trainPath, false);
  
  
  // Store separately for fallback logic
  cachedSynonymsDatabase = synonymsDb;
  cachedTrainDatabase = trainDb;
  
  // Create a combined database that prefers simple.csv but includes train.csv as fallback
  // Words from simple.csv take precedence, but we merge clues from train.csv for words not in simple.csv
  const combined: CluesDatabase = {
    byAnswer: { ...synonymsDb.byAnswer }, // Start with simple.csv words
    originalAnswers: new Map(synonymsDb.originalAnswers), // Start with simple.csv mappings
    easyWords: new Set(synonymsDb.easyWords),
    mediumWords: new Set(synonymsDb.mediumWords),
    challengingWords: new Set(synonymsDb.challengingWords),
    stats: {
      totalWords: synonymsDb.stats.totalWords,
      totalClues: synonymsDb.stats.totalClues,
      easyClues: synonymsDb.stats.easyClues,
      mediumClues: synonymsDb.stats.mediumClues,
      challengingClues: synonymsDb.stats.challengingClues,
      hardClues: synonymsDb.stats.hardClues,
      expertClues: synonymsDb.stats.expertClues,
    }
  };
  
  // Add words from train.csv that aren't in simple.csv
  for (const [word, entries] of Object.entries(trainDb.byAnswer)) {
    if (!combined.byAnswer[word]) {
      // Word not in simple.csv, add it from train.csv
      combined.byAnswer[word] = [...entries];
      combined.originalAnswers.set(word, trainDb.originalAnswers.get(word) || word);
      
      // Update word sets
      if (trainDb.easyWords.has(word)) combined.easyWords.add(word);
      if (trainDb.mediumWords.has(word)) combined.mediumWords.add(word);
      if (trainDb.challengingWords.has(word)) combined.challengingWords.add(word);
      
      // Update stats
      combined.stats.totalWords++;
      for (const entry of entries) {
        combined.stats.totalClues++;
        switch (entry.difficulty) {
          case 'easy': combined.stats.easyClues++; break;
          case 'medium': combined.stats.mediumClues++; break;
          case 'challenging': combined.stats.challengingClues++; break;
          case 'hard': combined.stats.hardClues++; break;
          case 'expert': combined.stats.expertClues++; break;
        }
      }
    }
  }
  
  console.log(`\n📚 Combined database: ${combined.stats.totalWords.toLocaleString()} words with ${combined.stats.totalClues.toLocaleString()} total clues`);
  console.log(`   Synonyms.csv: ${synonymsDb.stats.totalWords.toLocaleString()} words (preferred)`);
  console.log(`   Train.csv fallback: ${(combined.stats.totalWords - synonymsDb.stats.totalWords).toLocaleString()} additional words`);
  
  cachedCombinedDatabase = combined;
  return combined;
}

/**
 * Get the clues database, loading from CSV if not already cached
 */
export function getCluesDatabase(): CluesDatabase {
  if (!cachedCombinedDatabase) {
    loadCluesFromCSV();
  }
  return cachedCombinedDatabase!;
}

/**
 * Get the simple database (preferred source)
 */
export function getSynonymsDatabase(): CluesDatabase {
  if (!cachedSynonymsDatabase) {
    loadCluesFromCSV();
  }
  return cachedSynonymsDatabase!;
}

/**
 * Get the train database (fallback source)
 */
export function getTrainDatabase(): CluesDatabase {
  if (!cachedTrainDatabase) {
    loadCluesFromCSV();
  }
  return cachedTrainDatabase!;
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
 * Tries simple.csv first, then falls back to train.csv
 * For puzzle packages, we only want easy/medium/challenging (no hard/expert)
 */
export function getClueForWord(
  word: string, 
  preferDifficulty: ClueDifficulty = 'medium',
  maxDifficulty: ClueDifficulty = 'challenging'
): string | null {
  const normalizedWord = word.toUpperCase().replace(/\s+/g, '');
  
  // Build allowed difficulties based on max
  const difficultyOrder: ClueDifficulty[] = ['easy', 'medium', 'challenging', 'hard', 'expert'];
  const maxIndex = difficultyOrder.indexOf(maxDifficulty);
  const allowedDifficulties = new Set(difficultyOrder.slice(0, maxIndex + 1));
  
  // Helper function to get clue from a database
  const getClueFromDb = (db: CluesDatabase): string | null => {
    const entries = db.byAnswer[normalizedWord];
    if (!entries || entries.length === 0) {
      return null;
    }
    
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
    
    return null;
  };
  
  // Try synonyms.csv first (preferred), then train.csv
  const synonymsDb = getSynonymsDatabase();
  const synonymsClue = getClueFromDb(synonymsDb);
  if (synonymsClue) {
    return synonymsClue;
  }
  const trainDb = getTrainDatabase();
  const trainClue = getClueFromDb(trainDb);
  if (trainClue) {
    return trainClue;
  }
  
  // No clue found in either database
  return null;
}

/**
 * Get words that have clues at or below the specified max difficulty
 * This is used for puzzle generation to ensure all words have valid clues
 * Returns words from synonyms.csv first, then simple.csv, then train.csv (no duplicates)
 */
export function getWordsWithMaxDifficulty(maxDifficulty: ClueDifficulty): string[] {
  const difficultyOrder: ClueDifficulty[] = ['easy', 'medium', 'challenging', 'hard', 'expert'];
  let maxIndex = difficultyOrder.indexOf(maxDifficulty) + 1;
  
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
  const wordsFromPreferred = new Set<string>(); // Words already from synonyms or simple (order: synonyms → simple → train)

  // Helper: add words from a DB. For preferred sources (synonyms, simple) only add if not already added; mark as preferred. For train only add if not preferred.
  const getWordsFromDb = (db: CluesDatabase, isPreferred: boolean): void => {
    for (const [word, entries] of Object.entries(db.byAnswer)) {
      const hasValidClue = entries.some(e => allowedDifficulties.has(e.difficulty));
      if (hasValidClue) {
        const originalAnswer = db.originalAnswers.get(word) || word;
        if (isPreferred) {
          if (!wordsFromPreferred.has(word)) {
            validWords.push(originalAnswer);
            wordsFromPreferred.add(word);
          }
        } else {
          if (!wordsFromPreferred.has(word)) {
            validWords.push(originalAnswer);
          }
        }
      }
    }
  };
  // Order: synonyms first, then simple, then train
  const synonymsDb = getSynonymsDatabase();
  getWordsFromDb(synonymsDb, true);
  const trainDb = getTrainDatabase();
  getWordsFromDb(trainDb, false);
  
  if (validWords.length === 0) {
    const synonymsDb = getSynonymsDatabase();
    const trainDb = getTrainDatabase();
    const totalWordsInSynonyms = Object.keys(synonymsDb.byAnswer).length;
    const totalWordsInTrain = Object.keys(trainDb.byAnswer).length;
    console.error(`❌ No words found for difficulty '${maxDifficulty}'. This is a critical error!`);
    console.error(`   Total words in synonyms.csv: ${totalWordsInSynonyms}`);
    console.error(`   Total words in train.csv: ${totalWordsInTrain}`);
    console.error(`   Allowed difficulties: ${Array.from(allowedDifficulties).join(', ')}`);
    // Show sample of what difficulties exist in the database
    const sampleEntries = Object.entries(synonymsDb.byAnswer).slice(0, 10);
    console.error(`   Sample words from synonyms.csv and their difficulties:`);
    for (const [word, entries] of sampleEntries) {
      const difficulties = new Set(entries.map(e => e.difficulty));
      console.error(`     '${word}': [${Array.from(difficulties).join(', ')}]`);
    }
  }
  
  return validWords;
}

/**
 * Get words that have clues at or below the specified max difficulty,
 * from synonyms.csv only (no train.csv).
 * Use this for puzzle generation when we want to go heavy on easier clues.
 */
export function getWordsWithMaxDifficultyFromPreferredSourcesOnly(maxDifficulty: ClueDifficulty): string[] {
  const difficultyOrder: ClueDifficulty[] = ['easy', 'medium', 'challenging', 'hard', 'expert'];
  const maxIndex = difficultyOrder.indexOf(maxDifficulty) + 1;
  const allowedDifficulties =
    maxDifficulty === 'easy'
      ? new Set<ClueDifficulty>(['easy', 'medium'])
      : new Set(difficultyOrder.slice(0, Math.max(maxIndex, 1) + 1));

  const validWords: string[] = [];
  const seen = new Set<string>();
  const synonymsDb = getSynonymsDatabase();

  for (const [word, entries] of Object.entries(synonymsDb.byAnswer)) {
    const hasValidClue = entries.some(e => allowedDifficulties.has(e.difficulty));
    if (hasValidClue && !seen.has(word)) {
      seen.add(word);
      validWords.push(synonymsDb.originalAnswers.get(word) || word);
    }
  }

  return validWords;
}
