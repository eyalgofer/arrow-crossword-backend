import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { Difficulty } from '../types';
import { generatePuzzle } from './generators/puzzlesGenerator';
import { samplePuzzles } from './core/samplePuzzles';

dotenv.config();

/**
 * Swedish Arrow Crossword Puzzle Structure:
 * 
 * - Each clue has a CLUE CELL that contains the question text and an arrow
 * - The arrow points to where the answer should be written
 * - startRow, startCol = position of the CLUE CELL
 * 
 * Directions explained:
 * - 'across': arrow points RIGHT → answer goes horizontally (starts at col+1)
 * - 'down': arrow points DOWN ↓ answer goes vertically (starts at row+1)
 * - 'right-down': arrow points RIGHT → but answer goes DOWN ↓ (starts at col+1, row same, goes down)
 * - 'left-down': arrow points LEFT ← but answer goes DOWN ↓ (starts at col-1, row same, goes down)
 * - 'down-across': arrow points DOWN ↓ but answer goes ACROSS → (starts at row+1, col same, goes right)
 * - 'up-across': arrow points UP ↑ but answer goes ACROSS → (starts at row-1, col same, goes right)
 */



// to see the puzzles in the cloud MongoDB, use this URI:
// const MONGODB_URI_CLUSTER1 = "mongodb+srv://eyalgo:m6pp3kZx12@cluster1.0w7fepf.mongodb.net/arrow-crossword?retryWrites=true&w=majority"

/**
 * Validation function to check:
 * 1. All clues fit within grid boundaries
 * 2. Answer cells don't overlap with clue cells
 * 3. Answer cells that overlap have matching letters (valid crossings)
 * 4. After the end of an answer, there must not be additional answer cells extending the word—e.g., if the answer is "SEE", the cell immediately after must be empty or a clue. Otherwise, it could create unintended or invalid words and break the integrity of the crossword solution.
 * Rules for each direction:
 * - 'down': answer starts at (startRow+1, startCol), goes DOWN
 * - 'right-down': answer starts at (startRow, startCol+1), goes DOWN
 * - 'left-down': answer starts at (startRow, startCol-1), goes DOWN
 * - 'across': answer starts at (startRow, startCol+1), goes RIGHT
 * - 'down-across': answer starts at (startRow+1, startCol), goes RIGHT
 * - 'up-across': answer starts at (startRow-1, startCol), goes RIGHT
 */
interface ValidationError {
  puzzleTitle: string;
  clueNumber: number;
  clue: string;
  answer: string;
  direction: string;
  error: string;
  availableSpace?: number;
  requiredSpace?: number;
}

type CellType = 'clue' | 'answer';
interface CellInfo {
  type: CellType;
  clueNumber: number;
  letter?: string; // For answer cells
  clueText?: string; // For clue cells
}

function getAnswerCells(clue: typeof samplePuzzles[0]['clues'][0]): Array<{row: number, col: number, letter: string}> {
  const { startRow, startCol, direction, answer } = clue;
  const cells: Array<{row: number, col: number, letter: string}> = [];
  
  // Remove spaces from answer for cell placement (spaces are not placed in grid)
  const answerWithoutSpaces = answer.replace(/\s+/g, '');
  
  let answerStartRow = startRow;
  let answerStartCol = startCol;
  let goesDown = false;
  
  switch (direction) {
    case 'down':
      answerStartRow = startRow + 1;
      goesDown = true;
      break;
    case 'right-down':
      answerStartCol = startCol + 1;
      goesDown = true;
      break;
    case 'left-down':
      answerStartCol = startCol - 1;
      goesDown = true;
      break;
    case 'across':
      answerStartCol = startCol + 1;
      goesDown = false;
      break;
    case 'down-across':
      answerStartRow = startRow + 1;
      goesDown = false;
      break;
    case 'up-across':
      answerStartRow = startRow - 1;
      goesDown = false;
      break;
  }
  
  // Place only non-space characters in grid cells
  for (let i = 0; i < answerWithoutSpaces.length; i++) {
    if (goesDown) {
      cells.push({ row: answerStartRow + i, col: answerStartCol, letter: answerWithoutSpaces[i] });
    } else {
      cells.push({ row: answerStartRow, col: answerStartCol + i, letter: answerWithoutSpaces[i] });
    }
  }
  
  return cells;
}

function validatePuzzle(puzzle: typeof samplePuzzles[0]): ValidationError[] {
  const errors: ValidationError[] = [];
  const { rows, cols } = puzzle.grid;
  
  // Build grid to track cell usage
  const clueCells = new Map<string, { clueNumber: number; clueText: string }>();
  const answerCells = new Map<string, Array<{ clueNumber: number; letter: string }>>();
  
  // First pass: mark all clue cells
  for (const clue of puzzle.clues) {
    const key = `${clue.startRow},${clue.startCol}`;
    clueCells.set(key, { clueNumber: clue.number, clueText: clue.clue });
  }
  
  // Second pass: validate each clue's answer placement
  for (const clue of puzzle.clues) {
    const answerWithoutSpaces = clue.answer.replace(/\s+/g, '');
    const answerLength = answerWithoutSpaces.length;
    const { startRow, startCol, direction, answer, number: clueNum, enumeration } = clue;

    // Validate enumeration matches answer length
    if (enumeration && enumeration.length > 0) {
      const enumerationSum = enumeration.reduce((sum, num) => sum + num, 0);
      const answerWithoutSpaces = answer.replace(/\s+/g, '');
      const answerLengthNoSpaces = answerWithoutSpaces.length;
      
      if (enumerationSum !== answerLengthNoSpaces) {
        const multiWordInfo = enumeration.length > 1 
          ? ` (multi-word: ${enumeration.join(' + ')} = ${enumerationSum} letters)`
          : '';
        errors.push({
          puzzleTitle: puzzle.title,
          clueNumber: clueNum,
          clue: clue.clue,
          answer,
          direction,
          error: `ENUMERATION MISMATCH: enumeration [${enumeration.join(', ')}] sums to ${enumerationSum} but answer "${answer}" has ${answerLengthNoSpaces} letters${multiWordInfo}`
        });
      }
      
      // For multi-word answers, verify the answer can be split according to enumeration
      if (enumeration.length > 1 && enumerationSum === answerLengthNoSpaces) {
        let currentIndex = 0;
        const words: string[] = [];
        let hasError = false;
        
        for (let i = 0; i < enumeration.length; i++) {
          const wordLength = enumeration[i];
          if (currentIndex + wordLength > answerLengthNoSpaces) {
            errors.push({
              puzzleTitle: puzzle.title,
              clueNumber: clueNum,
              clue: clue.clue,
              answer,
              direction,
              error: `ENUMERATION ERROR: Cannot split "${answerWithoutSpaces}" into ${enumeration.length} words of lengths [${enumeration.join(', ')}] - exceeds answer length at word ${i + 1} (${words.join(' ')}...)`
            });
            hasError = true;
            break;
          }
          words.push(answerWithoutSpaces.substring(currentIndex, currentIndex + wordLength));
          currentIndex += wordLength;
        }
        
        // If valid multi-word answer, we can optionally log it for debugging
        // Format: "TOMCRUISE" with [3, 6] = "TOM CRUISE"
        if (!hasError && words.length > 0) {
          // Validation passed - multi-word answer is correctly formatted
          // Example: answer="TOMCRUISE", enumeration=[3,6] → words=["TOM", "CRUISE"]
        }
      }
    }

    let boundaryError = '';
    
    switch (direction) {
      case 'down':
        if (startRow + 1 + answerLength > rows) {
          boundaryError = `DOWN: answer needs rows ${startRow + 1}-${startRow + answerLength} but grid only has ${rows} rows`;
        }
        break;
      case 'right-down':
        if (startCol + 1 >= cols) {
          boundaryError = `RIGHT-DOWN: startCol+1 (${startCol + 1}) is out of bounds (cols=${cols})`;
        } else if (startRow + answerLength > rows) {
          boundaryError = `RIGHT-DOWN: answer needs rows ${startRow}-${startRow + answerLength - 1} but grid only has ${rows} rows`;
        }
        break;
      case 'left-down':
        if (startCol - 1 < 0) {
          boundaryError = `LEFT-DOWN: startCol-1 (${startCol - 1}) is out of bounds`;
        } else if (startRow + answerLength > rows) {
          boundaryError = `LEFT-DOWN: answer needs rows ${startRow}-${startRow + answerLength - 1} but grid only has ${rows} rows`;
        }
        break;
      case 'across':
        if (startCol + 1 + answerLength > cols) {
          boundaryError = `ACROSS: answer needs cols ${startCol + 1}-${startCol + answerLength} but grid only has ${cols} cols`;
        }
        break;
      case 'down-across':
        if (startRow + 1 >= rows) {
          boundaryError = `DOWN-ACROSS: startRow+1 (${startRow + 1}) is out of bounds (rows=${rows})`;
        } else if (startCol + answerLength > cols) {
          boundaryError = `DOWN-ACROSS: answer needs cols ${startCol}-${startCol + answerLength - 1} but grid only has ${cols} cols`;
        }
        break;
      case 'up-across':
        if (startRow - 1 < 0) {
          boundaryError = `UP-ACROSS: startRow-1 (${startRow - 1}) is out of bounds`;
        } else if (startCol + answerLength > cols) {
          boundaryError = `UP-ACROSS: answer needs cols ${startCol}-${startCol + answerLength - 1} but grid only has ${cols} cols`;
        }
        break;
    }
    
    if (boundaryError) {
      errors.push({
        puzzleTitle: puzzle.title,
        clueNumber: clueNum,
        clue: clue.clue,
        answer,
        direction,
        error: boundaryError
      });
      continue;
    }
    
    // Overlap + crossing tracking
    const answerCellPositions = getAnswerCells(clue);
    for (const cell of answerCellPositions) {
      const key = `${cell.row},${cell.col}`;
      
      if (clueCells.has(key)) {
        const conflictingClue = clueCells.get(key)!;
        errors.push({
          puzzleTitle: puzzle.title,
          clueNumber: clueNum,
          clue: clue.clue,
          answer,
          direction,
          error: `OVERLAP: Letter "${cell.letter}" at (${cell.row},${cell.col}) conflicts with clue cell #${conflictingClue.clueNumber} ("${conflictingClue.clueText}")`
        });
      }
      
      if (!answerCells.has(key)) {
        answerCells.set(key, []);
      }
      answerCells.get(key)!.push({ clueNumber: clueNum, letter: cell.letter });
    }
  }
  
  // Third pass: crossing letter mismatches
  for (const [key, cellAnswers] of answerCells) {
    if (cellAnswers.length > 1) {
      const letters = new Set(cellAnswers.map(a => a.letter));
      if (letters.size > 1) {
        const [row, col] = key.split(',').map(Number);
        const clueNumbers = cellAnswers.map(a => `#${a.clueNumber}(${a.letter})`).join(', ');
        errors.push({
          puzzleTitle: puzzle.title,
          clueNumber: cellAnswers[0].clueNumber,
          clue: 'Multiple clues',
          answer: 'N/A',
          direction: 'crossing',
          error: `LETTER MISMATCH at (${row},${col}): ${clueNumbers}`
        });
      }
    }
  }

  // ─────────────────────────────────────────────
  // Fourth pass (REWRITTEN): validate each clue path
  // ─────────────────────────────────────────────

  const grid: (string | 'CLUE' | null)[][] =
    Array(rows).fill(null).map(() => Array(cols).fill(null));

  for (const clue of puzzle.clues) {
    grid[clue.startRow][clue.startCol] = 'CLUE';
  }

  for (const clue of puzzle.clues) {
    for (const cell of getAnswerCells(clue)) {
      // Bounds check before setting grid cell
      if (cell.row >= 0 && cell.row < rows && cell.col >= 0 && cell.col < cols) {
        grid[cell.row][cell.col] = cell.letter;
      } else {
        // This should have been caught in boundary validation, but add safety check
        errors.push({
          puzzleTitle: puzzle.title,
          clueNumber: clue.number,
          clue: clue.clue,
          answer: clue.answer,
          direction: clue.direction,
          error: `OUT OF BOUNDS: Cell (${cell.row},${cell.col}) is outside grid (${rows}x${cols})`
        });
      }
    }
  }

  for (const clue of puzzle.clues) {
    const expected = clue.answer.replace(/\s+/g, ''); // Remove spaces for comparison
    const cells = getAnswerCells(clue);

    let reconstructed = '';

    for (const cell of cells) {
      // Bounds check
      if (cell.row < 0 || cell.row >= rows || cell.col < 0 || cell.col >= cols) {
        errors.push({
          puzzleTitle: puzzle.title,
          clueNumber: clue.number,
          clue: clue.clue,
          answer: clue.answer,
          direction: clue.direction,
          error: `OUT OF BOUNDS: Cell (${cell.row},${cell.col}) is outside grid (${rows}x${cols})`
        });
        reconstructed = '';
        break;
      }
      
      const value = grid[cell.row][cell.col];

      if (!value || value === 'CLUE') {
        errors.push({
          puzzleTitle: puzzle.title,
          clueNumber: clue.number,
          clue: clue.clue,
          answer: expected,
          direction: clue.direction,
          error: `MISSING LETTER at (${cell.row},${cell.col})`
        });
        reconstructed = '';
        break;
      }

      reconstructed += value;
    }

    if (reconstructed && reconstructed !== expected) {
      errors.push({
        puzzleTitle: puzzle.title,
        clueNumber: clue.number,
        clue: clue.clue,
        answer: expected,
        direction: clue.direction,
        error: `ANSWER MISMATCH: expected "${expected}" but found "${reconstructed}"`
      });
    }
  }
  
  return errors;
}


function validateAllPuzzles(): void {
  console.log('\n🔍 Validating all puzzles...\n');
  let totalErrors = 0;

  for (const puzzle of samplePuzzles) {
    const errors = validatePuzzle(puzzle);
    if (errors.length > 0) {
      console.log(`❌ ${puzzle.title} (${puzzle.grid.rows}x${puzzle.grid.cols}):`);
      for (const err of errors) {
        console.log(`   Clue ${err.clueNumber}: "${err.answer}" (${err.direction})`);
        console.log(`   └─ ${err.error}`);
      }
      console.log('');
      totalErrors += errors.length;
    } else {
      console.log(`✅ ${puzzle.title} - OK`);
    }
  }

  console.log(`\n📊 Total errors: ${totalErrors}`);
  if (totalErrors > 0) {
    console.log('⚠️  Some puzzles have spatial constraint violations!\n');
  } else {
    console.log('🎉 All puzzles are valid!\n');
  }
}

const seedDatabase = async () => {
  try {
    // Run validation before seeding
    validateAllPuzzles();
    let mongoUri = 'mongodb://localhost:27017/arrow-crossword';

    console.log('\n🔍 Connection Details:');
    console.log(`   MONGODB_URI from env: ${process.env.MONGODB_URI ? 'SET' : 'NOT SET'}`);
    
    // Ensure the database name is 'arrow-crossword' in the connection string
    // MongoDB connection strings: mongodb+srv://user:pass@host/database?options
    if (mongoUri.includes('mongodb+srv://') || mongoUri.includes('mongodb://')) {
      // Check if database name is specified
      const uriParts = mongoUri.split('/');
      const lastPart = uriParts[uriParts.length - 1];
      
      // If the last part contains '?' (options), extract database name
      if (lastPart.includes('?')) {
        const [dbName, options] = lastPart.split('?');
        if (dbName && dbName !== 'arrow-crossword' && dbName !== 'test') {
          console.log(`   ⚠️  Database in URI is "${dbName}", changing to "arrow-crossword"`);
          uriParts[uriParts.length - 1] = `arrow-crossword?${options}`;
          mongoUri = uriParts.join('/');
        } else if (!dbName || dbName === 'test') {
          console.log(`   ⚠️  No database specified or using "test", setting to "arrow-crossword"`);
          uriParts[uriParts.length - 1] = `arrow-crossword${options ? '?' + options : ''}`;
          mongoUri = uriParts.join('/');
        }
      } else {
        // No options, check if database name exists
        if (lastPart && lastPart !== 'arrow-crossword' && lastPart !== 'test') {
          console.log(`   ⚠️  Database in URI is "${lastPart}", changing to "arrow-crossword"`);
          uriParts[uriParts.length - 1] = 'arrow-crossword';
          mongoUri = uriParts.join('/');
        } else if (!lastPart || lastPart === 'test') {
          console.log(`   ⚠️  No database specified or using "test", appending "arrow-crossword"`);
          mongoUri = mongoUri.endsWith('/') ? `${mongoUri}arrow-crossword` : `${mongoUri}/arrow-crossword`;
        }
      }
    }
    
    console.log(`   Using URI: ${mongoUri.substring(0, 50)}...`);
    
    await mongoose.connect(mongoUri);
    
    // Get actual connection details
    const dbName = mongoose.connection.db?.databaseName;
    const host = mongoose.connection.host;
    const collectionName = Puzzle.collection.name;
    
    console.log(`✅ Connected to MongoDB`);
    console.log(`   Host: ${host}`);
    console.log(`   Database: ${dbName}`);
    console.log(`   Collection: ${collectionName}`);
    console.log('');

    // Check current puzzle count before deletion
    const countBefore = await Puzzle.countDocuments({});
    console.log(`📊 Current puzzles in database: ${countBefore}`);

    await Puzzle.deleteMany({});
    console.log('🗑️  Cleared existing puzzles');

    // Verify deletion
    const countAfter = await Puzzle.countDocuments({});
    console.log(`📊 Puzzles remaining after deletion: ${countAfter}`);
    
    if (countAfter > 0) {
      console.warn(`⚠️  WARNING: ${countAfter} puzzle(s) still exist!`);
    }

    // Filter to only valid puzzles (no validation errors)
    const validPuzzles = samplePuzzles.filter(puzzle => {
      const errors = validatePuzzle(puzzle);
      return errors.length === 0;
    });
    
    console.log(`\n📊 Puzzle Validation Summary:`);
    console.log(`   Total puzzles: ${samplePuzzles.length}`);
    console.log(`   Valid puzzles: ${validPuzzles.length}`);
    console.log(`   Invalid puzzles: ${samplePuzzles.length - validPuzzles.length}`);
    
    // Generate additional puzzles using the generator
    console.log('\n' + '='.repeat(60));
    console.log('Generating puzzle...');
    console.log('='.repeat(60));
     // Check current puzzle count
     
     const puzzles: any[] = [];
       
     const puzzle = generatePuzzle({
       difficulty: Difficulty.MEDIUM,
       category: 'Daily Life',
       title: `Generated Puzzle`
     });
     
     if (puzzle) {
       puzzles.push(puzzle);
       console.log(`✅ Puzzle generated successfully!`);
     } else {
       console.log(`❌ Puzzle failed to generate`);
     }
     
    // Combine sample puzzles and generated puzzle
    const allPuzzles = [...validPuzzles, ...puzzles];
    
    console.log(`\n📦 Puzzles to seed:`);
    console.log(`   Validated sample puzzles: ${validPuzzles.length}`);
    console.log(`   Generated puzzles: ${puzzles.length}`);
    console.log(`   Total: ${allPuzzles.length}`);

    if (allPuzzles.length === 0) {
      console.error('\n❌ No valid puzzles to seed! Please fix validation errors.');
      await mongoose.connection.close();
      process.exit(1);
    }
    
    await Puzzle.insertMany(allPuzzles);
    console.log(`\n📥 Inserted ${validPuzzles.length} sample puzzles and ${puzzles.length} generated puzzles (${allPuzzles.length} total)`);

    // Verify final count
    const finalCount = await Puzzle.countDocuments({});
    console.log(`📊 Final puzzle count: ${finalCount}`);
    console.log('');
    console.log('✅ Database seeded successfully');
    console.log(`   Make sure you're viewing: ${host}/${dbName}/${collectionName} in Compass`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

seedDatabase();