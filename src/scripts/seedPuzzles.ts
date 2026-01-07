import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Puzzle } from '../models/Puzzle';
import { Difficulty } from '../types';

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

const samplePuzzles = [
  // working examples
  {
    title: "Good Example",
    difficulty: Difficulty.EASY,
    category: "Daily Life",
    grid: { rows: 11, cols: 9 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Ensure', answer: 'SEE', enumeration: [3], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Private', answer: 'PERSONAL', enumeration: [8], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Stores', answer: 'FILES', enumeration: [5], startRow: 0, startCol: 4 },
      { number: 4, direction: 'left-down', clue: 'Roman marketplace', answer: 'FORUM', enumeration: [5], startRow: 0, startCol: 6 },
      { number: 5, direction: 'left-down', clue: 'Second Greek letter', answer: 'BETA', enumeration: [4], startRow: 0, startCol: 8 },
      { number: 6, direction: 'across', clue: 'Incidents', answer: 'EPISODES', enumeration: [8], startRow: 1, startCol: 0 },
      { number: 7, direction: 'down', clue: 'Strip', answer: 'GUR', enumeration: [3], startRow: 2, startCol: 4 },
      { number: 8, direction: 'down', clue: 'Loan', answer: 'LEND', enumeration: [4], startRow: 2, startCol: 6 },
      { number: 9, direction: 'down', clue: 'Fury', answer: 'RAGE', enumeration: [4], startRow: 2, startCol: 8 },
      { number: 10, direction: 'up-across', clue: 'Touch', answer: 'FEEL', enumeration: [4], startRow: 3, startCol: 0 },
      { number: 11, direction: 'across', clue: 'Usual', answer: 'REGULAR', enumeration: [7], startRow: 3, startCol: 1 },
      { number: 12, direction: 'across', clue: 'Take for granted', answer: 'ASSUME', enumeration: [6], startRow: 4, startCol: 0 },
      { number: 13, direction: 'down', clue: 'Assert', answer: 'ALLEGE', enumeration: [6], startRow: 4, startCol: 7 },
      { number: 14, direction: 'down-across', clue: 'Short skirt', answer: 'MINI', enumeration: [4], startRow: 5, startCol: 0 },
      { number: 15, direction: 'down', clue: 'Units', answer: 'ITEMS', enumeration: [5], startRow: 5, startCol: 1 },
      { number: 16, direction: 'down', clue: 'Deduce', answer: 'INFER', enumeration: [5], startRow: 5, startCol: 3 },
      { number: 17, direction: 'across', clue: 'Pester', answer: 'NAG', enumeration: [3], startRow: 5, startCol: 5 },
      { number: 18, direction: 'across', clue: 'Lazy', answer: 'IDLE', enumeration: [4], startRow: 6, startCol: 4 },
      { number: 19, direction: 'across', clue: 'Large basin', answer: 'TANK', enumeration: [4], startRow: 7, startCol: 0 },
      { number: 20, direction: 'down', clue: 'Kitchen container', answer: 'POT', enumeration: [3], startRow: 7, startCol: 5 },
      { number: 21, direction: 'down', clue: 'Belonging to us', answer: 'OUR', enumeration: [3], startRow: 7, startCol: 6 },
      { number: 22, direction: 'down', clue: 'Definite article', answer: 'THE', enumeration: [3], startRow: 7, startCol: 8 },
      { number: 23, direction: 'across', clue: 'Fairy', answer: 'ELF', enumeration: [3], startRow: 8, startCol: 0 },
      { number: 24, direction: 'across', clue: 'Bard', answer: 'POET', enumeration: [4], startRow: 8, startCol: 4 },
      { number: 25, direction: 'down-across', clue: 'Operator', answer: 'USER', enumeration: [4], startRow: 9, startCol: 0 },
      { number: 26, direction: 'across', clue: 'Sufficient', answer: 'ENOUGH', enumeration: [6], startRow: 9, startCol: 2 },
      { number: 27, direction: 'across', clue: 'Woody plant', answer: 'TREE', enumeration: [4], startRow: 10, startCol: 4 }
    ],
    estimatedTime: 90,
    coinReward: 10
  },
  {
    title: "Word Master",
    difficulty: Difficulty.CHALLENGING,
    category: "Language",
    grid: { rows: 13, cols: 12 },
    clues: [
      { number: 1, direction: 'right-down', clue: 'Verify', answer: 'CHECK', enumeration: [5], startRow: 0, startCol: 0 },
      { number: 2, direction: 'left-down', clue: 'Keep safe', answer: 'STORE', enumeration: [5], startRow: 0, startCol: 4 },
      { number: 3, direction: 'left-down', clue: 'Swift', answer: 'RAPID', enumeration: [5], startRow: 0, startCol: 6 },
      { number: 4, direction: 'left-down', clue: 'Commence', answer: 'START', enumeration: [5], startRow: 0, startCol: 8 },
      { number: 5, direction: 'left-down', clue: 'Magnificent', answer: 'GRAND', enumeration: [5], startRow: 0, startCol: 10 },
      { number: 6, direction: 'across', clue: 'H2O', answer: 'WATER', enumeration: [5], startRow: 6, startCol: 0 },
      { number: 7, direction: 'down-across', clue: 'Spot', answer: 'PLACE', enumeration: [5], startRow: 7, startCol: 0 },
      { number: 8, direction: 'down-across', clue: 'View', answer: 'SIGHT', enumeration: [5], startRow: 9, startCol: 0 },
      { number: 9, direction: 'down-across', clue: 'Navigate', answer: 'STEER', enumeration: [5], startRow: 11, startCol: 0 }
    ],
    estimatedTime: 120,
    coinReward: 18
  },
  {
    title: "Lexical Arrows Fixed",
    difficulty: Difficulty.CHALLENGING,
    category: "Language",
    grid: { rows: 18, cols: 18 },
    clues: [
      // ───────────── Top row (diagonal starters) ─────────────
      { number: 1, direction: 'right-down', clue: 'Make certain', answer: 'ENSURE', enumeration: [6], startRow: 0, startCol: 0 },
      { number: 2, direction: 'down', clue: 'Opposite of public', answer: 'PRIVATE', enumeration: [7], startRow: 0, startCol: 2 },
      { number: 3, direction: 'left-down', clue: 'Written records', answer: 'ARCHIVES', enumeration: [8], startRow: 0, startCol: 6 },
      { number: 4, direction: 'right-down', clue: 'Logical conclusion', answer: 'INFERENCE', enumeration: [9], startRow: 0, startCol: 11 },
      { number: 5, direction: 'left-down', clue: 'Strong displeasure', answer: 'RESENTMENT', enumeration: [10], startRow: 0, startCol: 16 },
  
      // ───────────── Horizontal spine ─────────────
      { number: 6, direction: 'across', clue: 'Take as true without proof', answer: 'ASSUMETRUE', enumeration: [6,4], startRow: 4, startCol: 0 },
      { number: 7, direction: 'across', clue: 'Unchanging pattern of behavior', answer: 'HABITFORM', enumeration: [5,4], startRow: 6, startCol: 0 },
      { number: 8, direction: 'across', clue: 'Capacity for understanding', answer: 'MENTALRANGE', enumeration: [6,5], startRow: 8, startCol: 0 },
      { number: 9, direction: 'across', clue: 'Person lacking motivation', answer: 'CHRONICSLACKER', enumeration: [7,7], startRow: 10, startCol: 0 },
  
      // ───────────── Vertical anchors ─────────────
      { number: 10, direction: 'down', clue: 'Formally accuse', answer: 'INDICT', enumeration: [6], startRow: 4, startCol: 5 },
      { number: 11, direction: 'down', clue: 'Make evident', answer: 'REVEAL', enumeration: [6], startRow: 4, startCol: 9 },
      { number: 12, direction: 'down', clue: 'Fail to notice', answer: 'OVERLOOK', enumeration: [8], startRow: 4, startCol: 14 },
  
      // ───────────── Mixed arrow complexity ─────────────
      { number: 13, direction: 'down-across', clue: 'Brief period of relief', answer: 'RESPITETIME', enumeration: [6,4], startRow: 9, startCol: 2 },
      { number: 14, direction: 'up-across', clue: 'Excessively detailed', answer: 'PEDANTIC', enumeration: [8], startRow: 14, startCol: 3 },
      { number: 15, direction: 'right-down', clue: 'Reduce in importance', answer: 'DOWNPLAY', enumeration: [8], startRow: 9, startCol: 11 },
      { number: 16, direction: 'left-down', clue: 'Clear mental picture', answer: 'VISUALIZE', enumeration: [9], startRow: 9, startCol: 16 },
  
      // ───────────── Bottom horizontals ─────────────
      { number: 17, direction: 'across', clue: 'Express indirectly', answer: 'IMPLYMEANING', enumeration: [5,7], startRow: 15, startCol: 0 },
      { number: 18, direction: 'across', clue: 'Gradual improvement', answer: 'SLOWUPTURN', enumeration: [4,6], startRow: 17, startCol: 0 }
    ],
    estimatedTime: 360,
    coinReward: 45
  }  
];

// to see the puzzles in the cloud MongoDB, use this URI:
// const MONGODB_URI_CLUSTER1 = "mongodb+srv://eyalgo:m6pp3kZx12@cluster1.0w7fepf.mongodb.net/arrow-crossword?retryWrites=true&w=majority"

/**
 * Validation function to check:
 * 1. All clues fit within grid boundaries
 * 2. Answer cells don't overlap with clue cells
 * 3. Answer cells that overlap have matching letters (valid crossings)
 * 
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
  
  for (let i = 0; i < answer.length; i++) {
    if (goesDown) {
      cells.push({ row: answerStartRow + i, col: answerStartCol, letter: answer[i] });
    } else {
      cells.push({ row: answerStartRow, col: answerStartCol + i, letter: answer[i] });
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
    const answerLength = clue.answer.length;
    const { startRow, startCol, direction, answer, number: clueNum } = clue;

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
      grid[cell.row][cell.col] = cell.letter;
    }
  }

  for (const clue of puzzle.clues) {
    const expected = clue.answer;
    const cells = getAnswerCells(clue);

    let reconstructed = '';

    for (const cell of cells) {
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

    await mongoose.connect('mongodb://localhost:27017/arrow-crossword');
    console.log('Connected to MongoDB');

    await Puzzle.deleteMany({});
    console.log('Cleared existing puzzles');

    await Puzzle.insertMany(samplePuzzles);
    console.log(`Inserted ${samplePuzzles.length} sample puzzles`);

    console.log('✅ Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDatabase();