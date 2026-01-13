const fs = require('fs');

// Read the clues.ts file
const filePath = 'src/scripts/core/clues.ts';
const content = fs.readFileSync(filePath, 'utf8');

// Extract the CLUES object content
const cluesMatch = content.match(/const CLUES[^=]*=\s*\{([\s\S]*)\};/);
if (!cluesMatch) {
  console.error('Could not parse CLUES object');
  process.exit(1);
}

const cluesBody = cluesMatch[1];
const clues = {};
let totalOriginal = 0;
let totalUnique = 0;
let duplicateKeys = 0;

// Parse each entry - improved regex to handle multi-line arrays
// The pattern matches: 'KEY': [ ... ] where ... can span multiple lines
// We need to match balanced brackets
let pos = 0;
const bodyLength = cluesBody.length;

while (pos < bodyLength) {
  // Skip whitespace
  while (pos < bodyLength && /\s/.test(cluesBody[pos])) pos++;
  if (pos >= bodyLength) break;
  
  // Look for 'KEY': [
  const keyMatch = cluesBody.substring(pos).match(/^'([^']+)':\s*\[/);
  if (!keyMatch) {
    pos++;
    continue;
  }
  
  const key = keyMatch[1];
  pos += keyMatch[0].length;
  
  // Now find the matching closing bracket
  let bracketDepth = 1;
  let arrayStart = pos;
  let inString = false;
  let escapeNext = false;
  
  while (pos < bodyLength && bracketDepth > 0) {
    const char = cluesBody[pos];
    
    if (escapeNext) {
      escapeNext = false;
      pos++;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      pos++;
      continue;
    }
    
    if (char === "'" && !escapeNext) {
      inString = !inString;
      pos++;
      continue;
    }
    
    if (!inString) {
      if (char === '[') {
        bracketDepth++;
      } else if (char === ']') {
        bracketDepth--;
      }
    }
    
    pos++;
  }
  
  // Extract array content (without the closing bracket)
  const arrayContent = cluesBody.substring(arrayStart, pos - 1);
  
  // Parse values from array
  const values = [];
  const valuePattern = /'((?:[^'\\]|\\.)*)'/g;
  let valueMatch;
  
  while ((valueMatch = valuePattern.exec(arrayContent)) !== null) {
    const value = valueMatch[1]
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\");
    values.push(value);
  }
  
  // Merge if key exists
  if (clues[key]) {
    duplicateKeys++;
    clues[key] = clues[key].concat(values);
  } else {
    clues[key] = values;
  }
}

// Remove duplicates within each array
for (const key in clues) {
  const values = clues[key];
  totalOriginal += values.length;
  
  // Remove duplicates while preserving order
  const uniqueValues = [];
  const seen = new Set();
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      uniqueValues.push(value);
    }
  }
  
  clues[key] = uniqueValues;
  totalUnique += uniqueValues.length;
}

// Generate new content
let newContent = '\n';
newContent += 'const CLUES: Record<string, string[]> = {\n';

// Sort keys alphabetically
const sortedKeys = Object.keys(clues).sort();

for (const key of sortedKeys) {
  const values = clues[key];
  const valuesStr = values.map(v => {
    // Escape single quotes and backslashes in values
    const escaped = v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }).join(', ');
  newContent += `  '${key}': [${valuesStr}],\n`;
}

newContent += '};\n';
newContent += '\n';
newContent += 'export default CLUES;\n';

// Write back to file
fs.writeFileSync(filePath, newContent);

console.log(`Found ${duplicateKeys} duplicate keys (merged)`);
console.log(`Removed ${totalOriginal - totalUnique} duplicate clues`);
console.log(`Total unique clues: ${totalUnique}`);
console.log(`Total entries: ${sortedKeys.length}`);
console.log(`Updated ${filePath}`);
