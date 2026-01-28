const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '../src/scripts/core/synonyms.csv');
const outputFile = path.join(__dirname, '../src/scripts/core/synonyms.csv');

console.log('Breaking down synonyms.csv...');
console.log('  - Converting each row with multiple terms into multiple rows');
console.log('  - Format: Word,Term1 -> Word,Term1; Word,Term2; etc.');

const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n');

// Process header
const header = lines[0];
const newLines = [header]; // Keep header as-is

let processed = 0;
let totalNewRows = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) {
    newLines.push('');
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
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());

  if (parts.length < 2) {
    // Skip lines with less than 2 parts
    continue;
  }

  // Get all terms (Word, Term1, Term2, ...)
  const allTerms = parts.filter(term => term && term.length > 0);

  if (allTerms.length < 2) {
    // Need at least Word and one Term
    continue;
  }

  const word = allTerms[0];
  const terms = allTerms.slice(1); // All terms after the word

  // Create a row for each term: Word,Term
  for (const term of terms) {
    if (term && term.trim()) {
      newLines.push(`${word},${term}`);
      totalNewRows++;
    }
  }

  processed++;
  if (processed % 10000 === 0) {
    console.log(`  Processed ${processed} lines, created ${totalNewRows} new rows...`);
  }
}

// Write back to file
fs.writeFileSync(outputFile, newLines.join('\n'), 'utf-8');

console.log(`\n✅ Done!`);
console.log(`   Processed ${processed} original rows`);
console.log(`   Created ${totalNewRows} new rows`);
console.log(`   Total rows in output: ${newLines.length}`);
console.log(`   Output written to: ${outputFile}`);
