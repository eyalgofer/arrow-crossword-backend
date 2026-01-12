const fs = require('fs');

// Read samplePuzzles.ts
const puzzlesContent = fs.readFileSync('src/scripts/core/samplePuzzles.ts', 'utf8');

// Extract all clue-answer pairs
const clueAnswerPairs = new Map();

// Match clue objects - handle both single and double quotes
const clueRegex = /clue:\s*['"]([^'"]+)['"],\s*answer:\s*['"]([^'"]+)['"]/g;
let match;

while ((match = clueRegex.exec(puzzlesContent)) !== null) {
  const clue = match[1];
  const answer = match[2].toUpperCase();
  
  if (!clueAnswerPairs.has(answer)) {
    clueAnswerPairs.set(answer, []);
  }
  
  const clues = clueAnswerPairs.get(answer);
  if (!clues.includes(clue)) {
    clues.push(clue);
  }
}

// Read current clues.ts
const cluesContent = fs.readFileSync('src/scripts/core/clues.ts', 'utf8');

// Parse existing CLUES object - more robust parsing
const existingClues = {};

// Find the CLUES object content
const cluesMatch = cluesContent.match(/const CLUES[^=]*=\s*\{([^}]+)\}/s);
if (cluesMatch) {
  const cluesBody = cluesMatch[1];
  
  // Match entries like 'ANSWER': ['clue1', 'clue2', ...]
  const entryRegex = /'([^']+)':\s*\[([^\]]+)\]/g;
  let entryMatch;
  
  while ((entryMatch = entryRegex.exec(cluesBody)) !== null) {
    const answer = entryMatch[1];
    const cluesStr = entryMatch[2];
    // Extract individual clues from the array
    const clues = cluesStr.split(',').map(c => {
      const trimmed = c.trim();
      return trimmed.replace(/^['"]|['"]$/g, '');
    }).filter(c => c.length > 0);
    existingClues[answer] = clues;
  }
}

// Merge new clues with existing ones
for (const [answer, newClues] of clueAnswerPairs.entries()) {
  if (existingClues[answer]) {
    // Merge, avoiding duplicates
    for (const clue of newClues) {
      if (!existingClues[answer].includes(clue)) {
        existingClues[answer].push(clue);
      }
    }
  } else {
    // New answer
    existingClues[answer] = newClues;
  }
}

// Sort answers alphabetically
const sortedAnswers = Object.keys(existingClues).sort();

// Generate new clues.ts content
let newContent = '\n';
newContent += 'const CLUES: Record<string, string[]> = {\n';

for (const answer of sortedAnswers) {
  const clues = existingClues[answer];
  const cluesStr = clues.map(c => {
    // Escape single quotes in clues
    const escaped = c.replace(/'/g, "\\'");
    return `'${escaped}'`;
  }).join(', ');
  newContent += `  '${answer}': [${cluesStr}],\n`;
}

newContent += '\n};\n';
newContent += '\n';
newContent += 'export default CLUES;\n';

// Write to file
fs.writeFileSync('src/scripts/core/clues.ts', newContent);
console.log(`Updated clues.ts with ${sortedAnswers.length} entries`);
console.log(`Added ${clueAnswerPairs.size} new answer entries from samplePuzzles.ts`);
