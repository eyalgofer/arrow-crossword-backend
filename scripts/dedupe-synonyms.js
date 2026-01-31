const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '../src/scripts/core/synonyms.csv');
const outputFile = path.join(__dirname, '../src/scripts/core/synonyms.csv');

console.log('Removing duplicates from synonyms.csv...');

const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n');

const header = lines[0];
const seen = new Set();
const unique = [header];

let duplicates = 0;
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (line.trim() === '') continue; // skip blank lines
  if (seen.has(line)) {
    duplicates++;
    continue;
  }
  seen.add(line);
  unique.push(line);
}

fs.writeFileSync(outputFile, unique.join('\n') + '\n', 'utf-8');

console.log(`\nDone! Removed ${duplicates} duplicate(s).`);
console.log(`  Before: ${lines.length} lines`);
console.log(`  After:  ${unique.length} lines (+ 1 newline)`);
