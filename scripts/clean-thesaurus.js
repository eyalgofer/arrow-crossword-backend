const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '../src/scripts/core/thesaurus.csv');
const outputFile = path.join(__dirname, '../src/scripts/core/thesaurus.csv.tmp');

console.log('Reading thesaurus.csv...');
const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n');

console.log(`Processing ${lines.length} lines...`);

// Function to remove parentheses and their contents
function removeParentheses(text) {
  if (!text) return text;
  return text.replace(/\([^)]*\)/g, '').trim();
}

const processedLines = [];
let processedCount = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) {
    processedLines.push('');
    continue;
  }

  // Parse CSV line - handle quoted fields
  const parts = [];
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

  if (parts.length === 0) {
    processedLines.push('');
    continue;
  }

  // Remove columns 2 and 3 (NumberOfMeanings and POS, indices 1 and 2)
  // Keep Word (index 0) and all Term columns (index 3+)
  const word = parts[0];
  const terms = parts.slice(3); // Skip NumberOfMeanings and POS

  // Remove parentheses from word and all terms
  const cleanedWord = removeParentheses(word);
  const cleanedTerms = terms.map(term => removeParentheses(term)).filter(term => term.length > 0);

  // Reconstruct the line: Word,Term1,Term2,...
  const newLine = [cleanedWord, ...cleanedTerms].join(',');
  processedLines.push(newLine);

  processedCount++;
  if (processedCount % 10000 === 0) {
    console.log(`  Processed ${processedCount} lines...`);
  }
}

console.log(`Writing cleaned data to temporary file...`);
fs.writeFileSync(outputFile, processedLines.join('\n'), 'utf-8');

console.log(`Replacing original file...`);
fs.renameSync(outputFile, inputFile);

console.log(`✅ Done! Processed ${processedCount} lines.`);
console.log(`   - Removed NumberOfMeanings and POS columns`);
console.log(`   - Removed all parentheses and their contents`);
