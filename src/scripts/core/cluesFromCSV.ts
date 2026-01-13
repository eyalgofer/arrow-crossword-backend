import * as fs from 'fs';
import * as path from 'path';

/**
 * Load clues from train.csv file
 * CSV format: id,clue,answer
 * Groups clues by answer (word) in uppercase, removing spaces for matching
 */
export function loadCluesFromCSV(): Record<string, string[]> {
  const csvPath = path.join(__dirname, 'train.csv');
  const clues: Record<string, string[]> = {};
  
  console.log(`📖 Loading clues from ${csvPath}...`);
  const startTime = Date.now();
  
  try {
    // Use streaming for large file
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n');
    
    let processed = 0;
    const batchSize = 100000;
    
    // Skip header line (id,clue,answer)
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
          // Handle escaped quotes ("")
          if (j + 1 < line.length && line[j + 1] === '"') {
            current += '"';
            j++; // Skip next quote
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
      parts.push(current); // Add last part
      
      if (parts.length >= 3) {
        const clue = parts[1].trim();
        // Normalize answer: uppercase, remove spaces for matching (crosswords use no spaces)
        const answer = parts[2].trim().toUpperCase().replace(/\s+/g, '');
        
        if (answer && clue) {
          if (!clues[answer]) {
            clues[answer] = [];
          }
          clues[answer].push(clue);
        }
      }
      
      processed++;
      if (processed % batchSize === 0) {
        const elapsed = Date.now() - startTime;
        console.log(`   Processed ${processed.toLocaleString()} lines (${(elapsed / 1000).toFixed(1)}s)...`);
      }
    }
    
    const elapsed = Date.now() - startTime;
    const wordCount = Object.keys(clues).length;
    const totalClues = Object.values(clues).reduce((sum, arr) => sum + arr.length, 0);
    
    console.log(`✅ Loaded ${wordCount.toLocaleString()} words with ${totalClues.toLocaleString()} total clues (${(elapsed / 1000).toFixed(1)}s)`);
    
    return clues;
  } catch (error) {
    console.error(`❌ Error loading clues from CSV:`, error);
    throw error;
  }
}

// Cache the loaded clues
let cachedClues: Record<string, string[]> | null = null;

/**
 * Get the clues object, loading from CSV if not already cached
 */
export function getClues(): Record<string, string[]> {
  if (!cachedClues) {
    cachedClues = loadCluesFromCSV();
  }
  return cachedClues;
}
