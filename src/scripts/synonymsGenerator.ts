const fs = require('fs');
const path = require('path');
const https = require('https');
import type { IncomingMessage } from 'http';

// Load seed words from simple.csv (answer column), grouped by difficulty
function loadSeedWordsFromSimpleCsv(): { easy: string[]; medium: string[]; hard: string[] } {
  const csvPath = path.join(__dirname, 'core', 'simple.csv');
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const lines = csv.trim().split('\n');
  const easy = new Set<string>();
  const medium = new Set<string>();
  const hard = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(',');
    if (parts.length < 4) continue;
    const answer = parts[parts.length - 2].trim().toLowerCase();
    const difficulty = parseInt(parts[parts.length - 1], 10);
    if (!answer || /[^a-z\s]/.test(answer)) continue; // letters/spaces only
    if (difficulty === 1) easy.add(answer);
    else if (difficulty === 2 || difficulty === 3) medium.add(answer);
    else if (difficulty === 4 || difficulty === 5) hard.add(answer);
  }

  return {
    easy: Array.from(easy),
    medium: Array.from(medium),
    hard: Array.from(hard)
  };
}

const seedWords = loadSeedWordsFromSimpleCsv();

// Fetch synonyms from Datamuse API
function fetchSynonyms(word: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const url = `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=10`;
    
    https.get(url, (res: IncomingMessage) => {
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          resolve(results.map((r: { word: string }) => r.word));
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', reject);
  });
}


// Check if word is valid for crossword (letters only, reasonable length)
function isValidWord(word: string): boolean {
  return /^[a-z]+$/.test(word) && word.length >= 3 && word.length <= 12;
}

// Main function
async function generateSynonymDataset() {
  const pairs = [];
  let id = 0;
  
  console.log('Fetching synonyms from Datamuse API...\n');
  
  // Process each difficulty level
  const levels = [
    { words: seedWords.easy, baseLevel: 1, name: 'easy' },
    { words: seedWords.medium, baseLevel: 3, name: 'medium' },
    { words: seedWords.hard, baseLevel: 4, name: 'hard' }
  ];
  
  for (const level of levels) {
    console.log(`Processing ${level.name} words...`);
    
    for (const word of level.words) {
      try {
        const synonyms = await fetchSynonyms(word);
        
        for (const synonym of synonyms) {
          if (isValidWord(synonym) && synonym !== word) {
            pairs.push({
              id: id++,
              clue: word,
              answer: synonym,
              difficulty: level.baseLevel
            });
          }
        }
        
        // Small delay to be nice to the API
        await new Promise(r => setTimeout(r, 100));
        
      } catch (err: any) {
        console.error(`Error fetching synonyms for "${word}":`, err.message);
      }
    }
  }
  
  // Remove duplicates (same clue-answer pair)
  const seen = new Set();
  const uniquePairs = pairs.filter(p => {
    const key = `${p.clue.toLowerCase()}-${p.answer.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Reassign IDs
  uniquePairs.forEach((p, i) => p.id = i);
  
  // Generate CSV
  const csvHeader = 'id,clue,answer,difficulty';
  const csvRows = uniquePairs.map(p => `${p.id},${p.clue},${p.answer},${p.difficulty}`);
  const csv = [csvHeader, ...csvRows].join('\n');
  
  // Write to file
  fs.writeFileSync('synonyms.csv', csv);
  
  console.log(`\nGenerated ${uniquePairs.length} synonym pairs`);
  console.log('Saved to synonyms-clues.csv');
  
  // Show sample
  console.log('\nSample entries:');
  uniquePairs.slice(0, 10).forEach(p => {
    console.log(`  ${p.id},${p.clue},${p.answer},${p.difficulty}`);
  });
  
  // Stats
  const byDifficulty = [1, 2, 3, 4, 5].map(d => 
    uniquePairs.filter(p => p.difficulty === d).length
  );
  console.log('\nDistribution by difficulty:');
  byDifficulty.forEach((count, i) => {
    console.log(`  Difficulty ${i + 1}: ${count} pairs`);
  });
}

generateSynonymDataset().catch(console.error);