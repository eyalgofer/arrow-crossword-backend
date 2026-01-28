const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '../src/scripts/core/thesaurus.csv');
const outputFile = path.join(__dirname, '../src/scripts/core/thesaurus.csv');

console.log('Processing thesaurus.csv...');
console.log('  - Removing NumberOfMeanings and POS columns');
console.log('  - Removing all content inside parentheses (including parentheses)');

const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n');

// Process header
const header = lines[0];
const headerParts = header.split(',');
// Remove columns at index 1 (NumberOfMeanings) and 2 (POS)
const newHeader = [headerParts[0], ...headerParts.slice(3)].join(',');

// Function to remove parentheses and their content
function removeParentheses(text) {
  if (!text) return text;
  // Remove everything inside parentheses including the parentheses
  // Handle both complete and incomplete parentheses
  let result = text;
  // Remove complete parentheses: (content)
  result = result.replace(/\([^)]*\)/g, '');
  // Remove incomplete parentheses at end: (content
  result = result.replace(/\([^)]*$/g, '');
  // Remove incomplete parentheses at start: content)
  result = result.replace(/^[^(]*\)/g, '');
  return result.trim();
}

// Process data lines
const processedLines = [newHeader];
let processed = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) {
    processedLines.push('');
    continue;
  }

  // Parse CSV line - handle quoted fields properly
  const parts = [];
  let current = '';
  let inQuotes = false;

  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    const nextChar = j + 1 < line.length ? line[j + 1] : '';

    if (char === "'" && !inQuotes && (j === 0 || line[j - 1] === ',' || line[j - 1] === '\n')) {
      // Start of quoted field
      inQuotes = true;
    } else if (char === "'" && inQuotes) {
      if (nextChar === "'") {
        // Escaped quote
        current += "'";
        j++;
      } else if (nextChar === ',' || nextChar === '' || nextChar === '\n') {
        // End of quoted field
        inQuotes = false;
      } else {
        current += char;
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
    // Remove columns at index 1 (NumberOfMeanings) and 2 (POS)
    const filteredParts = [parts[0], ...parts.slice(3)];
    
    // Remove parentheses from all fields
    const cleanedParts = filteredParts.map(part => removeParentheses(part));
    
    // Remove empty fields at the end
    while (cleanedParts.length > 0 && !cleanedParts[cleanedParts.length - 1]) {
      cleanedParts.pop();
    }
    
    if (cleanedParts.length > 0 && cleanedParts[0]) {
      processedLines.push(cleanedParts.join(','));
    }
  }

  processed++;
  if (processed % 10000 === 0) {
    console.log(`  Processed ${processed} lines...`);
  }
}

// Write back to file
fs.writeFileSync(outputFile, processedLines.join('\n'), 'utf-8');

console.log(`\n✅ Done! Processed ${processed} lines`);
console.log(`   Output written to: ${outputFile}`);
